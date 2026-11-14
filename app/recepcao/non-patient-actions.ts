// app/recepcao/non-patient-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { requireStaff } from "@/lib/require-staff";
import { buildNonPatientReason, nonPatientDraftRejectReason } from "@/lib/non-patient-contacts-pure";

/**
 * Botão "Não é paciente" (Autorizações e painel do chat).
 *
 * Marca o TELEFONE (não só o rascunho) para o próximo "oi" não recriar o card:
 *  - arquiva o rascunho aberto do WhatsApp com motivo explícito (sem mandar
 *    mensagem à família e sem apagar arquivo: dá para desfazer);
 *  - arquiva o paciente "interessado" (sem prontuário) que o robô tenha criado;
 *  - o chat continua aberto até alguém encerrar.
 * Contato com guia em andamento ou paciente com prontuário NÃO pode ser marcado.
 *
 * Usa o client admin (registration_drafts não tem policy de UPDATE de status
 * para todos os papéis); por isso o portão requireStaff vem primeiro.
 */

type Result = { success: true; reason?: string } | { success: false; error: string };

const OPEN_DRAFT_STATUSES = ["pending", "processing", "extracted", "failed"];
const REJECT_PREFIX = "Não é paciente:";

const loose = (admin: ReturnType<typeof createAdminClient>): SupabaseClient => admin as unknown as SupabaseClient;

function refresh() {
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/recepcao/atendimento");
  revalidatePath("/supervisao");
}

type DraftRow = {
  id: string;
  status: string;
  patient_id: string | null;
  extracted: unknown;
  guide_sent_at: string | null;
  plan_authorized_at: string | null;
  scheduling_enabled_at: string | null;
  authorization_id: string | null;
};

export async function markContactNotPatient(input: {
  phone?: string | null;
  draftId?: string | null;
  reasonValue: string;
  detail?: string | null;
}): Promise<Result> {
  const auth = await requireStaff(["recepcao", "supervisor"]);
  if (!auth.ok) return { success: false, error: auth.error };

  const reason = buildNonPatientReason(input.reasonValue, input.detail);
  if (!reason) return { success: false, error: "Escolha o motivo (em \"Outro\", descreva em poucas palavras)." };

  const admin = createAdminClient();
  const db = loose(admin);

  let phone = (input.phone ?? "").trim() || null;
  if (!phone && input.draftId) {
    const { data } = await admin.from("registration_drafts").select("source_phone").eq("id", input.draftId).maybeSingle();
    phone = data?.source_phone ?? null;
  }
  if (!phone) return { success: false, error: "Contato sem telefone: não dá para marcar." };

  const { data: draftsData } = await db
    .from("registration_drafts")
    .select("id, status, patient_id, extracted, guide_sent_at, plan_authorized_at, scheduling_enabled_at, authorization_id")
    .eq("source", "whatsapp")
    .eq("source_phone", phone)
    .neq("status", "rejected");
  const drafts = (draftsData ?? []) as DraftRow[];

  if (drafts.some((d) => d.guide_sent_at || d.plan_authorized_at || d.scheduling_enabled_at || d.authorization_id)) {
    return { success: false, error: "Este contato já tem guia ou agendamento em andamento. Não dá para marcar como \"não é paciente\"." };
  }

  const patientIds = [...new Set(drafts.map((d) => d.patient_id).filter((id): id is string => Boolean(id)))];
  const { data: patientsData } = patientIds.length
    ? await admin.from("patients").select("id, status").in("id", patientIds)
    : { data: [] as { id: string; status: string }[] };
  const patients = patientsData ?? [];
  if (patients.some((p) => p.status !== "interessado" && p.status !== "arquivado")) {
    return { success: false, error: "Este contato já é paciente com prontuário. Não dá para marcar como \"não é paciente\"." };
  }
  const interessadoIds = patients.filter((p) => p.status === "interessado").map((p) => p.id);

  const now = new Date().toISOString();
  const { data: mark, error: markError } = await db
    .from("non_patient_contacts")
    .upsert(
      {
        clinic_id: DEV_CLINIC_ID,
        phone,
        reason,
        marked_by: auth.userId,
        marked_at: now,
        archived_patient_id: interessadoIds[0] ?? null,
      },
      { onConflict: "clinic_id,phone" },
    )
    .select("id")
    .single();
  if (markError || !mark) {
    console.error("[Não é paciente] Falha ao marcar:", markError?.message);
    return { success: false, error: "Não foi possível marcar agora. Tente de novo." };
  }

  const openDraftIds = drafts.filter((d) => OPEN_DRAFT_STATUSES.includes(d.status)).map((d) => d.id);
  if (openDraftIds.length > 0) {
    await admin
      .from("registration_drafts")
      .update({ status: "rejected", rejected_at: now, rejected_by: auth.userId, reject_reason: nonPatientDraftRejectReason(reason) })
      .in("id", openDraftIds);
  }
  if (interessadoIds.length > 0) {
    await admin.from("patients").update({ status: "arquivado" }).in("id", interessadoIds).eq("status", "interessado");
  }

  await admin.from("audit_log").insert({
    table_name: "non_patient_contacts",
    row_id: (mark as { id: string }).id,
    action: "non_patient_marked",
    actor_id: auth.userId,
    clinic_id: DEV_CLINIC_ID,
    after: { phone, reason, rejected_drafts: openDraftIds, archived_patients: interessadoIds },
  });

  refresh();
  return { success: true, reason };
}

/**
 * Desfaz a marcação: apaga a linha, devolve o paciente arquivado para
 * "interessado" e reabre o rascunho que a marcação tinha arquivado (se não
 * houver outro aberto para o mesmo telefone).
 */
export async function unmarkContactNotPatient(phone: string): Promise<Result> {
  const auth = await requireStaff(["recepcao", "supervisor"]);
  if (!auth.ok) return { success: false, error: auth.error };
  if (!phone) return { success: false, error: "Contato sem telefone." };

  const admin = createAdminClient();
  const db = loose(admin);

  const { data: markData } = await db
    .from("non_patient_contacts")
    .select("id, reason, archived_patient_id, marked_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("phone", phone)
    .maybeSingle();
  const mark = markData as { id: string; reason: string; archived_patient_id: string | null; marked_at: string } | null;
  if (!mark) return { success: true };

  await db.from("non_patient_contacts").delete().eq("id", mark.id);

  if (mark.archived_patient_id) {
    await admin.from("patients").update({ status: "interessado" }).eq("id", mark.archived_patient_id).eq("status", "arquivado");
  }

  let reopenedDraftId: string | null = null;
  const { data: openDraft } = await admin
    .from("registration_drafts")
    .select("id")
    .eq("source", "whatsapp")
    .eq("source_phone", phone)
    .in("status", OPEN_DRAFT_STATUSES)
    .limit(1)
    .maybeSingle();
  if (!openDraft) {
    const { data: rejected } = await admin
      .from("registration_drafts")
      .select("id, extracted")
      .eq("source", "whatsapp")
      .eq("source_phone", phone)
      .eq("status", "rejected")
      .like("reject_reason", `${REJECT_PREFIX}%`)
      .order("rejected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rejected) {
      await admin
        .from("registration_drafts")
        .update({ status: rejected.extracted ? "extracted" : "pending", rejected_at: null, rejected_by: null, reject_reason: null })
        .eq("id", rejected.id);
      reopenedDraftId = rejected.id;
    }
  }

  await admin.from("audit_log").insert({
    table_name: "non_patient_contacts",
    row_id: mark.id,
    action: "non_patient_unmarked",
    actor_id: auth.userId,
    clinic_id: DEV_CLINIC_ID,
    before: { phone, reason: mark.reason, marked_at: mark.marked_at },
    after: { restored_patient: mark.archived_patient_id, reopened_draft: reopenedDraftId },
  });

  refresh();
  return { success: true };
}
