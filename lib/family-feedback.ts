// lib/family-feedback.ts
// Categorias e escala usadas pela página "Avalie" do portal da família
// (app/familia/avalie) e pela leitura em app/gestor/nps — mantidas num só
// lugar pra não divergir entre o form e a normalização do painel.

export const FEEDBACK_RATING_VALUES = ["ruim", "regular", "bom", "otimo"] as const;
export type FeedbackRatingValue = (typeof FEEDBACK_RATING_VALUES)[number];

export const FEEDBACK_RATING_LABEL: Record<FeedbackRatingValue, string> = {
  ruim: "Ruim",
  regular: "Regular",
  bom: "Bom",
  otimo: "Ótimo",
};

// Pontuação 1-4 usada para normalizar pra escala 0-10 comparável ao NPS.
export const FEEDBACK_RATING_SCORE: Record<FeedbackRatingValue, number> = {
  ruim: 1,
  regular: 2,
  bom: 3,
  otimo: 4,
};

// No máximo 4 categorias (PRD "Avalie").
export const FEEDBACK_CATEGORIES = [
  { key: "recepcao", label: "Atendimento da Recepção" },
  { key: "terapeuta", label: "Evolução Terapêutica & Equipe" },
  { key: "pontualidade", label: "Pontualidade & Agendamento" },
  { key: "instalacoes", label: "Instalações & Conforto" },
] as const;
export type FeedbackCategoryKey = (typeof FEEDBACK_CATEGORIES)[number]["key"];

/** Média das categorias respondidas, normalizada pra escala 0-10 (NPS-like). */
export function normalizeFeedbackToNps10(ratings: Record<string, string>): number | null {
  const values = Object.values(ratings)
    .filter((v): v is FeedbackRatingValue => (FEEDBACK_RATING_VALUES as readonly string[]).includes(v))
    .map((v) => FEEDBACK_RATING_SCORE[v]);
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  // escala 1-4 -> 0-10
  return ((avg - 1) / 3) * 10;
}

/** Nota Twilio (1-5) normalizada pra escala 0-10, mesma base de comparação. */
export function normalizeTwilioScoreToNps10(score: number): number {
  return ((score - 1) / 4) * 10;
}
