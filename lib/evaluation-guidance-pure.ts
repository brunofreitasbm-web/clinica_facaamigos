// lib/evaluation-guidance-pure.ts
// Mensagem de orientações que vai entre a confirmação do horário e o convite da
// pré-anamnese. Puro e sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/evaluation-guidance-pure.test.ts).
// O texto do template aprovado na Meta (scripts/create-eval-offer-template.ts,
// GUIDANCE_BODY) precisa ser idêntico a este, com {{1}} = nome da criança.

const BRAND_LINE = "FaçaAmigos - Centro de Terapia Comportamental";

export function buildEvaluationGuidanceMessage(childName: string): string {
  return (
    "✅ Seu 1º agendamento está confirmado! 🎉\n\n" +
    "⏰ No dia da avaliação, chegue com 15 minutos de antecedência.\n\n" +
    `📂 Traga todos os exames, laudos e documentações de ${childName}. 🧩💙\n\n` +
    BRAND_LINE
  );
}
