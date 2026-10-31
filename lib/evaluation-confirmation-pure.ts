// lib/evaluation-confirmation-pure.ts
// Mensagem única de confirmação da 1ª avaliação (já inclui as orientações do dia).
// Puro e sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/evaluation-confirmation-pure.test.ts).
// O texto do template aprovado na Meta (scripts/create-eval-offer-template.ts,
// CONFIRM_BODY) precisa ser idêntico a este, com {{1}} = responsável, {{2}} = criança,
// {{3}} = data curta, {{4}} = profissional.

const BRAND_LINE = "FaçaAmigos - Centro de Terapia Comportamental";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-10-30" + "14:30" → "sex, 30/10 às 14h30". Sem Date local: independe do fuso do servidor. */
export function formatEvaluationDateShort(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  const [hh, mm] = time.split(":");
  return `${weekday}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} às ${hh}h${mm}`;
}

export function buildEvaluationConfirmationMessage(params: {
  guardianFirstName: string;
  patientName: string;
  formattedDate: string;
  therapistName: string;
}): string {
  return (
    `Olá, ${params.guardianFirstName}! 💙\n\n` +
    "✅ Agendamento confirmado!\n" +
    `A 1ª avaliação de ${params.patientName} será em ${params.formattedDate}, com ${params.therapistName}.\n\n` +
    "⏰ Chegue 15 minutos antes.\n" +
    "📂 Traga documento com foto e laudos, exames ou relatórios anteriores.\n\n" +
    BRAND_LINE
  );
}

/** Remarcação: não usa o template de confirmação (diria "confirmado" sem avisar que a data mudou). */
export function buildEvaluationRescheduleMessage(params: {
  guardianFirstName: string;
  patientName: string;
  formattedDate: string;
  therapistName: string;
}): string {
  return (
    `Olá, ${params.guardianFirstName}! 💙\n\n` +
    "🔄 A data da avaliação foi alterada.\n" +
    `A 1ª avaliação de ${params.patientName} agora será em ${params.formattedDate}, com ${params.therapistName}.\n\n` +
    "⏰ Chegue 15 minutos antes.\n" +
    "📂 Traga documento com foto e laudos, exames ou relatórios anteriores.\n\n" +
    BRAND_LINE
  );
}

/**
 * Mensagem única: confirmação (já com as orientações do dia) + convite da pré-anamnese, no lugar
 * de duas mensagens seguidas. Os botões (preanam_yes/preanam_no) vêm do template; o texto precisa
 * ser idêntico a BUNDLE_BODY de scripts/create-eval-offer-template.ts.
 */
export function buildEvaluationBundleMessage(params: {
  guardianFirstName: string;
  patientName: string;
  formattedDate: string;
  therapistName: string;
}): string {
  return (
    `Olá, ${params.guardianFirstName}! 💙\n\n` +
    "✅ Agendamento confirmado!\n" +
    `A 1ª avaliação de ${params.patientName} será em ${params.formattedDate}, com ${params.therapistName}.\n\n` +
    "⏰ Chegue 15 minutos antes.\n" +
    "📂 Traga documento com foto e laudos, exames ou relatórios anteriores.\n\n" +
    "Para o terapeuta chegar mais preparado, podemos fazer 5 perguntas rápidas por aqui? As respostas não substituem a avaliação presencial.\n\n" +
    BRAND_LINE
  );
}
