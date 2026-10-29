// app/recepcao/pacientes/pendencias/draft-adjust-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { normalizeCpf, normalizePhone } from "@/lib/document-extraction";
import type { Json } from "@/lib/database.types";

/**
 * Ajuste autônomo de cadastro pela tela de Autorizações / Fila de pendências.
 *
 * Recepção e supervisão corrigem aqui o que o bot ou a IA gravaram errado
 * (nome, CPF, CID, carteirinha, responsável) e separam irmãos que chegaram no
 * mesmo contato. Escritas de negócio usam o client de sessão — a RLS de
 * patients/guardians/patient_insurance/registration_drafts já limita a
 * recepcao/supervisor/gestor. Só o INSERT do rascunho do irmão usa o admin
 * client (registration_drafts não tem policy de INSERT), e só depois de a
 * leitura do rascunho de origem, via sessão, provar o papel do usuário.
 */

type Result = { success: true; note?: string } | { success: false; error: string };

export type DraftAdjustData = {
  draftId: string;
  patient: {
    id: string | null;
    fullName: string;
    birthDate: string;
    cpf: string;
    cid: string;
    complaint: string;
  };
  guardian: { id: string | null; fullName: string; phone: string; cpf: string; email: string };
  insurance: { id: string | null; cardNumber: string };
};

const SESSION_EXPIRED = "Sessão expirada. Faça login de novo.";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function refresh(patientId?: string | null) {
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/supervisao");
  if (patientId) revalidatePath(`/recepcao/pacientes/${patientId}`);
}

/** Valores atuais do contato, para pré-preencher o formulário de ajuste. */
export async function loadDraftAdjustment(
  draftId: string,
): Promise<{ success: true; data: DraftAdjustData } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: SESSION_EXPIRED };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, guardian_id, extracted")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  const ext = asRecord(draft.extracted);
  const extPatient = asRecord(ext.patient);
  const extGuardian = asRecord(ext.guardian);
  const extInsurance = asRecord(ext.insurance);

  const [{ data: patient }, { data: guardians }, { data: insurances }] = draft.patient_id
    ? await Promise.all([
        supabase
          .from("patients")
          .select("id, full_name, birth_date, cpf, cid, complaint")
          .eq("id", draft.patient_id)
          .maybeSingle(),
        supabase
          .from("guardians")
          .select("id, full_name, phone, cpf, email, is_financial")
          .eq("patient_id", draft.patient_id)
          .order("is_financial", { ascending: false }),
        supabase
          .from("patient_insurance")
          .select("id, card_number")
          .eq("patient_id", draft.patient_id)
          .order("id", { ascending: true }),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const guardian = (guardians ?? []).find((g) => g.id === draft.guardian_id) ?? guardians?.[0] ?? null;
  const insurance = insurances?.[0] ?? null;

  return {
    success: true,
    data: {
      draftId,
      patient: {
        id: patient?.id ?? null,
        fullName: patient?.full_name ?? text(extPatient.full_name),
        birthDate: patient?.birth_date ?? text(extPatient.birth_date),
        cpf: patient?.cpf ?? text(extPatient.cpf),
        cid: patient?.cid ?? text(extPatient.cid),
        complaint: patient?.complaint ?? text(extPatient.complaint_hint),
      },
      guardian: {
        id: guardian?.id ?? null,
        fullName: guardian?.full_name ?? text(extGuardian.full_name),
        phone: guardian?.phone ?? text(extGuardian.phone),
        cpf: guardian?.cpf ?? text(extGuardian.cpf),
        email: guardian?.email ?? text(extGuardian.email),
      },
      insurance: { id: insurance?.id ?? null, cardNumber: insurance?.card_number ?? text(extInsurance.card_number) },
    },
  };
}

/**
 * Grava as correções. Com paciente vinculado, atualiza as tabelas reais; sempre
 * espelha o resultado em `registration_drafts.extracted`, que é o que a fila
 * mostra ("Dados já recebidos") — sem isso a tela continuaria exibindo o valor
 * antigo mesmo com o prontuário já corrigido.
 */
export async function saveDraftAdjustment(draftId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: SESSION_EXPIRED };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, guardian_id, extracted")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  const fullName = str(formData, "patient_full_name");
  const birthDate = str(formData, "patient_birth_date");
  const cpfRaw = str(formData, "patient_cpf");
  const cid = str(formData, "patient_cid");
  const complaint = str(formData, "patient_complaint");
  const guardianName = str(formData, "guardian_full_name");
  const guardianPhoneRaw = str(formData, "guardian_phone");
  const guardianCpfRaw = str(formData, "guardian_cpf");
  const guardianEmail = str(formData, "guardian_email");
  const cardNumber = str(formData, "card_number");

  if (!fullName) return { success: false, error: "Informe o nome da criança." };
  if (birthDate && !ISO_DATE.test(birthDate)) return { success: false, error: "Data de nascimento inválida." };
  const cpf = cpfRaw ? normalizeCpf(cpfRaw) : null;
  if (cpfRaw && !cpf) return { success: false, error: "CPF da criança inválido." };
  const guardianCpf = guardianCpfRaw ? normalizeCpf(guardianCpfRaw) : null;
  if (guardianCpfRaw && !guardianCpf) return { success: false, error: "CPF do responsável inválido." };
  const guardianPhone = guardianPhoneRaw ? normalizePhone(guardianPhoneRaw) : null;
  if (guardianPhoneRaw && !guardianPhone) return { success: false, error: "Telefone do responsável inválido." };
  if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
    return { success: false, error: "E-mail do responsável inválido." };
  }

  if (draft.patient_id) {
    if (!birthDate) return { success: false, error: "Informe a data de nascimento." };

    const { error: patientError } = await supabase
      .from("patients")
      .update({
        full_name: fullName,
        birth_date: birthDate,
        cpf,
        cid: cid || null,
        complaint: complaint || null,
      })
      .eq("id", draft.patient_id);
    if (patientError) {
      return {
        success: false,
        error:
          patientError.code === "23505"
            ? "Já existe outro paciente com este CPF."
            : "Não foi possível atualizar a criança.",
      };
    }

    const guardianId = str(formData, "guardian_id") || draft.guardian_id;
    if (guardianId && guardianName) {
      const { error } = await supabase
        .from("guardians")
        .update({
          full_name: guardianName,
          ...(guardianPhone ? { phone: guardianPhone } : {}),
          cpf: guardianCpf,
          email: guardianEmail || null,
        })
        .eq("id", guardianId)
        .eq("patient_id", draft.patient_id);
      if (error) return { success: false, error: "Criança salva, mas não foi possível atualizar o responsável." };
    }

    const insuranceId = str(formData, "insurance_id");
    if (insuranceId) {
      const { error } = await supabase
        .from("patient_insurance")
        .update({ card_number: cardNumber || null })
        .eq("id", insuranceId)
        .eq("patient_id", draft.patient_id);
      if (error) return { success: false, error: "Criança salva, mas não foi possível atualizar a carteirinha." };
    }
  }

  const ext = asRecord(draft.extracted);
  const nextExtracted = {
    ...ext,
    patient: {
      ...asRecord(ext.patient),
      full_name: fullName,
      birth_date: birthDate || null,
      cpf,
      cid: cid || null,
      complaint_hint: complaint || asRecord(ext.patient).complaint_hint || null,
    },
    guardian: {
      ...asRecord(ext.guardian),
      full_name: guardianName || null,
      phone: guardianPhone ?? asRecord(ext.guardian).phone ?? null,
      cpf: guardianCpf,
      email: guardianEmail || null,
    },
    insurance: { ...asRecord(ext.insurance), card_number: cardNumber || null },
  };

  const { error: draftError } = await supabase
    .from("registration_drafts")
    .update({ extracted: nextExtracted as Json })
    .eq("id", draftId);
  if (draftError) return { success: false, error: "Dados salvos, mas a fila não pôde ser atualizada." };

  refresh(draft.patient_id);
  return { success: true };
}

/**
 * Separa um irmão que chegou junto no mesmo contato: cria paciente, responsável
 * (cópia do atual), convênio e um rascunho próprio. O rascunho é o que a Agenda
 * de 1ª Avaliação consulta (lib/evaluation-agenda.ts: um gate por patient_id),
 * por isso cada criança precisa do seu — e herda o "plano autorizou /
 * agendamento habilitado" do contato de origem, já que o pedido foi aprovado
 * para a família.
 */
export async function splitSiblingFromDraft(draftId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: SESSION_EXPIRED };

  const { data: source } = await supabase
    .from("registration_drafts")
    .select(
      "id, clinic_id, patient_id, guardian_id, source, source_phone, extracted, plan_authorized_at, plan_authorized_by, scheduling_enabled_at, scheduling_enabled_by, guide_sent_at, guide_sent_by, authorization_waived",
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!source) return { success: false, error: "Contato não encontrado." };
  if (!source.patient_id) {
    return { success: false, error: "Cadastre a primeira criança (Conferir e cadastrar) antes de adicionar o irmão." };
  }

  const fullName = str(formData, "sibling_full_name");
  const birthDate = str(formData, "sibling_birth_date");
  const cpfRaw = str(formData, "sibling_cpf");
  const cid = str(formData, "sibling_cid");
  const cardNumber = str(formData, "sibling_card_number");
  if (!fullName) return { success: false, error: "Informe o nome do irmão." };
  if (!ISO_DATE.test(birthDate)) return { success: false, error: "Informe a data de nascimento do irmão." };
  const cpf = cpfRaw ? normalizeCpf(cpfRaw) : null;
  if (cpfRaw && !cpf) return { success: false, error: "CPF do irmão inválido." };

  const [{ data: sibling }, { data: guardians }, { data: insurances }] = await Promise.all([
    supabase.from("patients").select("entry_source, complaint").eq("id", source.patient_id).maybeSingle(),
    supabase
      .from("guardians")
      .select("full_name, phone, cpf, rg, email, relationship, is_financial, is_emergency_contact, lgpd_consent_at, image_consent")
      .eq("patient_id", source.patient_id)
      .order("is_financial", { ascending: false })
      .limit(1),
    supabase
      .from("patient_insurance")
      .select("insurer_id, plan_name, card_valid_until")
      .eq("patient_id", source.patient_id)
      .order("id", { ascending: true })
      .limit(1),
  ]);
  const guardian = guardians?.[0];
  const insurance = insurances?.[0];

  const { data: created, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: source.clinic_id ?? DEV_CLINIC_ID,
      full_name: fullName,
      birth_date: birthDate,
      cpf,
      cid: cid || null,
      complaint: sibling?.complaint ?? null,
      status: "avaliacao",
      entry_source: sibling?.entry_source ?? "cadastro_assistido_ia",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (patientError || !created) {
    return {
      success: false,
      error: patientError?.code === "23505" ? "Já existe um paciente com este CPF." : "Não foi possível criar o irmão.",
    };
  }

  // Passos seguintes: se algum falhar, desfaz o paciente para não deixar cadastro pela metade.
  // patients não tem policy de DELETE para a sessão, então o desfazer usa o admin client.
  const admin = createAdminClient();
  const rollback = async () => {
    await admin.from("guardians").delete().eq("patient_id", created.id);
    await admin.from("patient_insurance").delete().eq("patient_id", created.id);
    await admin.from("patients").delete().eq("id", created.id);
  };

  let guardianId: string | null = null;
  if (guardian) {
    const { data: g, error } = await supabase
      .from("guardians")
      .insert({ ...guardian, patient_id: created.id })
      .select("id")
      .single();
    if (error || !g) {
      await rollback();
      return { success: false, error: "Não foi possível copiar o responsável para o irmão." };
    }
    guardianId = g.id;
  }

  if (insurance) {
    const { error } = await supabase
      .from("patient_insurance")
      .insert({ ...insurance, patient_id: created.id, card_number: cardNumber || null, is_private: false });
    if (error) {
      await rollback();
      return { success: false, error: "Não foi possível criar o convênio do irmão." };
    }
  }

  const ext = asRecord(source.extracted);
  const { error: draftError } = await admin.from("registration_drafts").insert({
    clinic_id: source.clinic_id,
    patient_id: created.id,
    guardian_id: guardianId,
    source: source.source,
    source_phone: source.source_phone,
    status: "validated",
    extracted: {
      patient: { full_name: fullName, birth_date: birthDate, cpf, cid: cid || null },
      guardian: ext.guardian ?? null,
      insurance: { ...asRecord(ext.insurance), card_number: cardNumber || null },
    } as Json,
    plan_authorized_at: source.plan_authorized_at,
    plan_authorized_by: source.plan_authorized_by,
    scheduling_enabled_at: source.scheduling_enabled_at,
    scheduling_enabled_by: source.scheduling_enabled_by,
    guide_sent_at: source.guide_sent_at,
    guide_sent_by: source.guide_sent_by,
    authorization_waived: source.authorization_waived,
    validated_at: new Date().toISOString(),
    validated_by: user.id,
  });
  if (draftError) {
    await rollback();
    return { success: false, error: "Não foi possível registrar o irmão na fila de autorizações." };
  }

  refresh(source.patient_id);
  return {
    success: true,
    note: source.plan_authorized_at
      ? "Irmão criado já liberado para agendar (herdou a autorização do contato)."
      : "Irmão criado. Ele aparece na fila de Autorizações para seguir o fluxo próprio.",
  };
}
