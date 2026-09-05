import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";

/**
 * Período trimestral civil (§9.7: "questionário trimestral") — "2026-Q3"
 * pro trimestre jul-set/2026. Calculado no servidor, nunca recebido do
 * cliente, pra não deixar o responsável escolher em qual trimestre a
 * resposta conta (a constraint única em survey_responses é por período).
 */
export function currentSurveyPeriod(): string {
  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const [year, month] = today.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}
