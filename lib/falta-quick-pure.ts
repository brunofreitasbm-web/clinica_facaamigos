// lib/falta-quick-pure.ts
import { CANCEL_REASONS, NEGATIVE_STATUSES } from "./appointment-cancel-reasons.ts";

/**
 * Registro rápido de falta/cancelamento na agenda do dia (regra 5 do AGENTS.md:
 * tarefa rotineira em até 3 cliques). O caso comum, "Falta da família", vem
 * pré-selecionado: abrir o painel (1) e tocar no motivo (2) já registra.
 * Mudar o status é um clique a mais, só para quem foge do caso comum.
 */
export const DEFAULT_NEGATIVE_STATUS = "falta_familia";

/** "Outro" exige texto e portanto não envia no toque: precisa de um passo de confirmação. */
export function reasonNeedsDetail(reason: string): boolean {
  return reason === "outro";
}

export type FaltaSubmitInput = { status: string; reason: string; detail?: string };

/** Valida e monta o FormData que `markMissedOrCancelled` espera; devolve erro legível se faltar algo. */
export function buildFaltaFormData(input: FaltaSubmitInput): { ok: true; formData: FormData } | { ok: false; error: string } {
  if (!NEGATIVE_STATUSES.some((s) => s.value === input.status)) return { ok: false, error: "Escolha o que aconteceu." };
  if (!CANCEL_REASONS.some((r) => r.value === input.reason)) return { ok: false, error: "Escolha o motivo." };
  const detail = (input.detail ?? "").trim();
  if (reasonNeedsDetail(input.reason) && !detail) return { ok: false, error: "Descreva o motivo para continuar." };
  const formData = new FormData();
  formData.set("target_status", input.status);
  formData.set("reason", input.reason);
  if (detail) formData.set("reason_other", detail);
  return { ok: true, formData };
}
