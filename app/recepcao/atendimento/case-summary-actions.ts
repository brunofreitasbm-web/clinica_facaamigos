"use server";

import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getSingleRegistrationDraft } from "@/lib/reception-queue";
import { buildFilaItem, filaStageSummary } from "@/lib/fila/fila-model-pure";
import { draftToFilaSource } from "@/lib/fila/fila-source";
import type { CaseDraftInput } from "@/lib/atendimento/case-summary-pure";

export type CaseSummaryData = {
  draft: CaseDraftInput | null;
  patient: { fullName: string; birthDate: string | null } | null;
  insurance: { insurerName: string; planName: string | null }[];
};

/**
 * Dados do resumo do caso no painel lateral do Chat. SOMENTE LEITURA.
 *
 * Diferente de `getLeadDraftByConversationId` (actions.ts), que ABRE um rascunho se o telefone não tiver
 * um (é o clique em "Resolver pendências"), aqui abrir a conversa nunca cria nada: o painel é consultado
 * a cada conversa aberta e criar rascunho por visualização geraria processos paralelos na fila de
 * Autorizações (ver AGENTS.md, diretriz 3).
 */
export async function getCaseSummaryData(
  conversationId: string,
): Promise<({ success: true } & CaseSummaryData) | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { data: conversation } = await supabase
    .from("twilio_conversations")
    .select("id, phone_number, patient_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return { success: false, error: "Conversa não encontrada." };

  // Rascunho MAIS RECENTE do telefone, de qualquer status: um rascunho já conferido ("validated")
  // mostra a etapa "Habilitado p/ agendamento", que é justamente o que a recepção quer ver.
  const { data: latest } = conversation.phone_number
    ? await supabase
        .from("registration_drafts")
        .select("id")
        .eq("source", "whatsapp")
        .eq("source_phone", conversation.phone_number)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const [draftFull, patientRes, insuranceRes] = await Promise.all([
    latest ? getSingleRegistrationDraft(supabase, latest.id, DEV_CLINIC_ID) : Promise.resolve(null),
    conversation.patient_id
      ? supabase.from("patients").select("full_name, birth_date").eq("id", conversation.patient_id).maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.patient_id
      ? supabase.from("patient_insurance").select("plan_name, insurers(name)").eq("patient_id", conversation.patient_id)
      : Promise.resolve({ data: [] }),
  ]);

  const draft: CaseDraftInput | null = draftFull
    ? {
        id: draftFull.id,
        status: draftFull.status,
        facts: draftFull.facts,
        pipeline: {
          authorization: draftFull.pipeline.authorization,
          schedulingEnabledAt: draftFull.pipeline.schedulingEnabledAt,
          registered: draftFull.pipeline.registered,
          returned: draftFull.pipeline.returned
            ? { reason: draftFull.pipeline.returned.reason, byName: draftFull.pipeline.returned.byName }
            : null,
        },
        stage: filaStageSummary(
          buildFilaItem(
            draftToFilaSource(draftFull, {
              id: draftFull.id,
              patientName: draftFull.patientName ?? "",
              assignedToId: null,
              assignedToName: null,
              overdue: false,
              postponed: false,
            }),
            Date.now(),
          ),
        ),
        missingCount: draftFull.pendencies.missingCount,
        missingSummary: draftFull.pendencies.summary,
        filesCount: draftFull.files.length,
      }
    : null;

  const patientRow = patientRes.data;
  const insurance = (insuranceRes.data ?? []).map((row) => {
    const insurer = Array.isArray(row.insurers) ? row.insurers[0] : row.insurers;
    return { insurerName: insurer?.name ?? "Plano de Saúde", planName: row.plan_name };
  });

  return {
    success: true,
    draft,
    patient: patientRow ? { fullName: patientRow.full_name, birthDate: patientRow.birth_date } : null,
    insurance,
  };
}
