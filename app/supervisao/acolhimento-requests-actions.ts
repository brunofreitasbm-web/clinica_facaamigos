"use server";

// app/supervisao/acolhimento-requests-actions.ts
//
// Ações da Supervisão sobre o fluxo de acolhimento (FASE 4,
// acolhimento_requests — ver lib/acolhimento-requests.ts). Nome
// deliberadamente diferente de "acolhimento-actions.ts" (já existente nesta
// pasta, mas para o fluxo BEM diferente de lotes de PDF de convênio /
// insurance_intake_leads) — evita colidir com esse arquivo e confundir os
// dois conceitos de "acolhimento" que o app tem hoje.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextStatuses, type AcolhimentoFunding, type AcolhimentoStatus } from "@/lib/acolhimento-requests";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Supervisão define a grade fixa do paciente (na tela de Grade,
 * grade-panel.tsx) e marca aqui que a etapa foi concluída: grava
 * `grade_defined_at`, fecha a etapa `grade_definida` do checklist de entrada
 * (intake_steps — a única das 4 etapas novas que NÃO é fechada
 * automaticamente por trigger, ver supabase/migrations/20260917170600_
 * acolhimento_requests.sql) e avança o status pro próximo elo válido da
 * cadeia (via nextStatuses, nunca hardcoded — 'contrato_pendente' se ainda
 * não passou por lá, senão 'concluido').
 */
export async function markGradeDefined(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("acolhimento_requests")
    .select("id, patient_id, funding, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return { success: false, error: "Acolhimento não encontrado." };
  }
  if (request.status !== "grade_pendente") {
    return { success: false, error: "Este acolhimento não está aguardando definição de grade." };
  }

  const now = new Date().toISOString();

  const { error: intakeError } = await supabase
    .from("intake_steps")
    .update({ status: "concluida", completed_at: now })
    .eq("patient_id", request.patient_id)
    .eq("step_key", "grade_definida");

  if (intakeError) {
    return { success: false, error: "Não foi possível concluir a etapa de checklist da grade." };
  }

  const allowed = nextStatuses(request.status as AcolhimentoStatus, request.funding as AcolhimentoFunding);
  // grade_pendente só tem um próximo elo natural (concluido) além de
  // cancelado — pega o primeiro que não for 'cancelado'.
  const nextStatus = allowed.find((s) => s !== "cancelado") ?? "concluido";

  const { error: updateError } = await supabase
    .from("acolhimento_requests")
    .update({ grade_defined_at: now, status: nextStatus })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: "Etapa marcada, mas não foi possível atualizar o status do acolhimento." };
  }

  revalidatePath("/supervisao");
  revalidatePath("/recepcao/acolhimentos");
  revalidatePath("/gestor/acolhimentos");
  return { success: true };
}
