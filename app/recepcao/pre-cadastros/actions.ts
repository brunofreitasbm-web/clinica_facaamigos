// app/recepcao/pre-cadastros/actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { claimAndProcessDrafts } from "@/lib/registration-drafts-process";
import { normalizeCpf, parseBrDate, normalizeUf, normalizeCep, normalizePhone } from "@/lib/document-extraction";
import { sendTwilioWhatsApp } from "@/lib/twilio";

type ActionResult = { success: true; patientId: string; warnings: string[] } | { success: false; error: string };
type SimpleResult = { success: true } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };

const SIGNED_URL_TTL_SECONDS = 900;
const DOCUMENTS_BUCKET = "clinic-documents";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Confirma um rascunho do "cadastro assistido por IA" — cria/atualiza
 * paciente, responsável, convênio e guia com os campos que a recepção
 * confirmou (checkbox "Aplicar" por bloco), e move os arquivos do rascunho
 * para `documents` com a categoria escolhida. Toda escrita de negócio usa o
 * client de sessão (RLS decide o que este usuário pode gravar); o client
 * admin só move Storage e fecha o rascunho. Nunca escreve nada sem essa
 * confirmação explícita — a extração da IA nunca chega às tabelas reais
 * sozinha.
 */
export async function validateRegistrationDraft(draftId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, guardian_id, source_phone, clinic_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Rascunho não encontrado." };

  const warnings: string[] = [];
  const linkPatientId = str(formData, "link_patient_id") || draft.patient_id || null;

  // --- Paciente -----------------------------------------------------
  let patientId = linkPatientId;
  if (formData.get("apply_patient") === "on") {
    const fullName = str(formData, "patient_full_name");
    const birthDate = str(formData, "patient_birth_date");
    const cpf = normalizeCpf(str(formData, "patient_cpf")) ?? undefined;
    const sexo = str(formData, "patient_sexo");
    const naturalidade = str(formData, "patient_naturalidade") || null;
    const cid = str(formData, "patient_cid") || null;
    const complaint = str(formData, "patient_complaint") || null;

    if (!patientId) {
      if (!fullName || !birthDate) {
        return { success: false, error: "Preencha nome e data de nascimento da criança para criar o cadastro." };
      }
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: DEV_CLINIC_ID,
          full_name: fullName,
          birth_date: birthDate,
          cpf,
          sexo: sexo === "F" || sexo === "M" ? sexo : null,
          naturalidade,
          cid,
          complaint,
          status: "interessado",
          entry_source: "cadastro_assistido_ia",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error || !created) {
        return { success: false, error: "Não foi possível criar o paciente. Confira o CPF (pode já existir na clínica)." };
      }
      patientId = created.id;
      // Grava já aqui pra idempotência: se o resto da action falhar, uma
      // nova tentativa de validação encontra o paciente já criado em vez de
      // duplicar.
      const admin = createAdminClient();
      await admin.from("registration_drafts").update({ patient_id: patientId }).eq("id", draftId);
    } else if (fullName || birthDate || cpf || sexo || naturalidade || cid || complaint) {
      const { error } = await supabase
        .from("patients")
        .update({
          ...(fullName ? { full_name: fullName } : {}),
          ...(birthDate ? { birth_date: birthDate } : {}),
          ...(cpf ? { cpf } : {}),
          ...(sexo === "F" || sexo === "M" ? { sexo } : {}),
          ...(naturalidade ? { naturalidade } : {}),
          ...(cid ? { cid } : {}),
          ...(complaint ? { complaint } : {}),
        })
        .eq("id", patientId);
      if (error) warnings.push("Paciente já existia, mas alguns campos não puderam ser atualizados.");
    }
  }

  if (!patientId) {
    return { success: false, error: "Selecione ou preencha os dados do paciente antes de confirmar." };
  }

  // --- Endereço (parte de patients, aplicado junto se o bloco existir) ---
  if (formData.get("apply_address") === "on") {
    const { error } = await supabase
      .from("patients")
      .update({
        address_cep: normalizeCep(str(formData, "address_cep")),
        address_logradouro: str(formData, "address_logradouro") || null,
        address_numero: str(formData, "address_numero") || null,
        address_complemento: str(formData, "address_complemento") || null,
        address_bairro: str(formData, "address_bairro") || null,
        address_cidade: str(formData, "address_cidade") || null,
        address_uf: normalizeUf(str(formData, "address_uf")),
      })
      .eq("id", patientId);
    if (error) warnings.push("Não foi possível salvar o endereço.");
  }

  // --- Responsável ----------------------------------------------------
  let guardianId = draft.guardian_id;
  if (formData.get("apply_guardian") === "on") {
    const fullName = str(formData, "guardian_full_name");
    const phone = normalizePhone(str(formData, "guardian_phone") || draft.source_phone || "");
    const cpf = normalizeCpf(str(formData, "guardian_cpf")) ?? undefined;
    const rg = str(formData, "guardian_rg") || null;
    const email = str(formData, "guardian_email") || null;
    const relationship = str(formData, "guardian_relationship") || null;

    if (!guardianId) {
      if (!fullName || !phone) {
        return { success: false, error: "Preencha nome e telefone do responsável para criar o cadastro." };
      }
      const { data: created, error } = await supabase
        .from("guardians")
        .insert({
          patient_id: patientId,
          full_name: fullName,
          phone,
          cpf,
          rg,
          email,
          relationship,
          is_financial: true,
          is_emergency_contact: true,
        })
        .select("id")
        .single();
      if (error || !created) {
        return { success: false, error: "Paciente salvo, mas houve erro ao salvar o responsável." };
      }
      guardianId = created.id;
    } else if (fullName || phone || cpf || rg || email || relationship) {
      const { error } = await supabase
        .from("guardians")
        .update({
          ...(fullName ? { full_name: fullName } : {}),
          ...(phone ? { phone } : {}),
          ...(cpf ? { cpf } : {}),
          ...(rg ? { rg } : {}),
          ...(email ? { email } : {}),
          ...(relationship ? { relationship } : {}),
        })
        .eq("id", guardianId);
      if (error) warnings.push("Responsável já existia, mas alguns campos não puderam ser atualizados.");
    }
  }

  // --- Convênio ---------------------------------------------------------
  const insurerId = str(formData, "insurer_id");
  if (formData.get("apply_insurance") === "on" && insurerId) {
    const cardNumber = str(formData, "insurance_card_number") || null;
    const planName = str(formData, "insurance_plan_name") || null;
    const cardValidUntil = parseBrDate(str(formData, "insurance_card_valid_until"));

    const { data: existing } = await supabase
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", patientId)
      .eq("insurer_id", insurerId)
      .maybeSingle();

    let patientInsuranceId = existing?.id ?? null;
    if (!patientInsuranceId) {
      const { data: created, error } = await supabase
        .from("patient_insurance")
        .insert({
          patient_id: patientId,
          insurer_id: insurerId,
          card_number: cardNumber,
          plan_name: planName,
          card_valid_until: cardValidUntil,
          is_private: false,
        })
        .select("id")
        .single();
      if (error || !created) {
        warnings.push("Não foi possível vincular o convênio ao paciente.");
      } else {
        patientInsuranceId = created.id;
      }
    } else {
      await supabase
        .from("patient_insurance")
        .update({
          ...(cardNumber ? { card_number: cardNumber } : {}),
          ...(planName ? { plan_name: planName } : {}),
          ...(cardValidUntil ? { card_valid_until: cardValidUntil } : {}),
        })
        .eq("id", patientInsuranceId);
    }

    // --- Guia de autorização ---------------------------------------
    if (formData.get("apply_authorization") === "on" && patientInsuranceId) {
      const procedureCode = str(formData, "authorization_procedure_code");
      const sessionsAuthorized = Number(str(formData, "authorization_sessions_authorized") || "0");
      const validFrom = parseBrDate(str(formData, "authorization_valid_from")) || str(formData, "authorization_valid_from");
      const validTo = parseBrDate(str(formData, "authorization_valid_to")) || str(formData, "authorization_valid_to");

      if (procedureCode && sessionsAuthorized > 0 && validFrom && validTo) {
        const { error } = await supabase.from("authorizations").insert({
          patient_insurance_id: patientInsuranceId,
          guide_number: str(formData, "authorization_guide_number") || null,
          procedure_code: procedureCode,
          sessions_authorized: sessionsAuthorized,
          valid_from: validFrom,
          valid_to: validTo,
          status: "ativa",
          authorization_password: str(formData, "authorization_password") || null,
          password_valid_until: parseBrDate(str(formData, "authorization_password_valid_until")),
        });
        if (error) warnings.push("Convênio vinculado, mas não foi possível registrar a guia de autorização.");
      } else {
        warnings.push("Guia não cadastrada: faltou procedimento, sessões autorizadas ou vigência.");
      }
    }
  }

  // --- Arquivos: WhatsApp copia pra `documents`; portal só troca categoria ---
  const admin = createAdminClient();
  const { data: files } = await admin
    .from("registration_draft_files")
    .select("id, storage_path, mime_type, document_id, detected_type")
    .eq("draft_id", draftId);

  for (const file of files ?? []) {
    const category = str(formData, `file_category_${file.id}`) || file.detected_type || "outro";

    if (file.document_id) {
      const { error } = await supabase
        .from("documents")
        .update({ category, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq("id", file.document_id);
      if (error) warnings.push("Não foi possível categorizar um dos arquivos enviados pelo portal.");
      continue;
    }

    const documentId = randomUUID();
    const fileName = file.storage_path.split("/").pop() ?? "arquivo";
    const destPath = `${patientId}/${documentId}/${fileName}`;

    const { error: copyError } = await admin.storage.from(DOCUMENTS_BUCKET).copy(file.storage_path, destPath);
    if (copyError) {
      warnings.push("Não foi possível anexar um dos arquivos enviados pelo WhatsApp.");
      continue;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      patient_id: patientId,
      category,
      storage_path: destPath,
      uploaded_by: user.id,
      shared_with_family: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      note: "Enviado por WhatsApp — cadastro assistido por IA",
    });
    if (insertError) {
      await admin.storage.from(DOCUMENTS_BUCKET).remove([destPath]);
      warnings.push("Não foi possível salvar um dos arquivos enviados pelo WhatsApp.");
      continue;
    }
    await admin.from("registration_draft_files").update({ document_id: documentId }).eq("id", file.id);
  }

  await admin
    .from("registration_drafts")
    .update({ status: "validated", validated_at: new Date().toISOString(), validated_by: user.id, patient_id: patientId, guardian_id: guardianId })
    .eq("id", draftId);

  await admin.from("audit_log").insert({
    table_name: "registration_drafts",
    row_id: draftId,
    action: "draft_validated",
    actor_id: user.id,
    clinic_id: draft.clinic_id,
    after: { patient_id: patientId, warnings },
  });

  if (draft.source_phone) {
    const { data: patient } = await supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle();
    await sendTwilioWhatsApp({
      to: draft.source_phone,
      message: `Cadastro de *${patient?.full_name ?? "seu(sua) filho(a)"}* conferido pela recepção. ✅ Os documentos foram guardados com segurança. Qualquer dúvida, é só responder aqui.`,
    }).catch(() => null);
  }

  revalidatePath("/recepcao");
  revalidatePath("/recepcao/pre-cadastros");
  revalidatePath(`/recepcao/pacientes/${patientId}`);
  revalidatePath("/recepcao/pacientes/pendencias");

  return { success: true, patientId, warnings };
}

/**
 * Rejeita um rascunho — nunca vira cadastro. Apaga os arquivos ainda em
 * `drafts/<id>/*` do Storage (LGPD: não reter documento de terceiro sem
 * cadastro associado); arquivos que já eram `documents` do portal (com
 * document_id) permanecem como estavam.
 */
export async function rejectRegistrationDraft(draftId: string, reason: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, clinic_id, source_phone")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Rascunho não encontrado." };

  const admin = createAdminClient();
  const { data: files } = await admin
    .from("registration_draft_files")
    .select("storage_path, document_id")
    .eq("draft_id", draftId);

  const draftOnlyPaths = (files ?? []).filter((f) => !f.document_id).map((f) => f.storage_path);
  if (draftOnlyPaths.length > 0) {
    await admin.storage.from(DOCUMENTS_BUCKET).remove(draftOnlyPaths);
  }

  await admin
    .from("registration_drafts")
    .update({ status: "rejected", rejected_at: new Date().toISOString(), rejected_by: user.id, reject_reason: reason || null })
    .eq("id", draftId);

  await admin.from("audit_log").insert({
    table_name: "registration_drafts",
    row_id: draftId,
    action: "draft_rejected",
    actor_id: user.id,
    clinic_id: draft.clinic_id,
    after: { reason },
  });

  if (draft.source_phone) {
    await sendTwilioWhatsApp({
      to: draft.source_phone,
      message: `Olá! Não conseguimos aproveitar os documentos enviados${reason ? `: ${reason}` : "."} Se puder, reenvie com boa iluminação e o documento inteiro na foto. 🙏`,
    }).catch(() => null);
  }

  revalidatePath("/recepcao/pre-cadastros");
  return { success: true };
}

/** Reprocessa um rascunho específico (botão "Reprocessar com IA" da tela de revisão). */
export async function reprocessRegistrationDraft(draftId: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { data: draft } = await supabase.from("registration_drafts").select("id").eq("id", draftId).maybeSingle();
  if (!draft) return { success: false, error: "Rascunho não encontrado." };

  const results = await claimAndProcessDrafts({ draftId });
  const result = results[0];
  if (!result || result.status === "failed") {
    return { success: false, error: result?.error ?? "Não foi possível reprocessar agora." };
  }

  revalidatePath(`/recepcao/pre-cadastros/${draftId}`);
  return { success: true };
}

/** Link assinado de um arquivo do rascunho — mesmo padrão de getDocumentUrl. */
export async function getDraftFileUrl(fileId: string): Promise<UrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: file } = await supabase
    .from("registration_draft_files")
    .select("id, storage_path, draft_id, registration_drafts(clinic_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { success: false, error: "Arquivo não encontrado." };

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return { success: false, error: "Não foi possível gerar o link do arquivo." };

  const draftRef = Array.isArray(file.registration_drafts) ? file.registration_drafts[0] : file.registration_drafts;
  await admin.from("audit_log").insert({
    table_name: "registration_draft_files",
    row_id: file.id,
    action: "download",
    actor_id: user.id,
    clinic_id: draftRef?.clinic_id ?? null,
  });

  return { success: true, url: signed.signedUrl };
}
