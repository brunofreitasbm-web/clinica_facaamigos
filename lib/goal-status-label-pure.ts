// lib/goal-status-label-pure.ts

/**
 * Rótulo do status de uma meta do PTS no relatório de reavaliação. `ativa` = ainda em
 * análise pela coordenação; `atingida` = validada (a validação grava esse status, ver
 * app/supervisao/plan-actions.ts); `suspensa` = devolvida para ajuste.
 */
export function goalStatusLabel(status: string): { text: string; tone: "ok" | "wait" | "back" } {
  if (status === "atingida") return { text: "Atingida / validada", tone: "ok" };
  if (status === "suspensa") return { text: "Devolvida para ajuste", tone: "back" };
  return { text: "Em análise", tone: "wait" };
}
