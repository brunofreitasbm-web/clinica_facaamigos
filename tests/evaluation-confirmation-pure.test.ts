// tests/evaluation-confirmation-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEvaluationBundleMessage,
  buildEvaluationConfirmationMessage,
  buildEvaluationRescheduleMessage,
  formatEvaluationDateShort,
} from "../lib/evaluation-confirmation-pure.ts";

test("data curta com dia da semana e horário", () => {
  assert.equal(formatEvaluationDateShort("2026-10-30", "14:30"), "sex, 30/10 às 14h30");
  assert.equal(formatEvaluationDateShort("2026-11-02", "09:00"), "seg, 02/11 às 09h00");
});

test("confirmação traz data, profissional e orientações numa mensagem só", () => {
  const msg = buildEvaluationConfirmationMessage({
    guardianFirstName: "Ana",
    patientName: "Lucas",
    formattedDate: "sex, 30/10 às 14h30",
    therapistName: "Dra. Bia",
  });
  assert.match(msg, /^Olá, Ana! 💙/);
  assert.match(msg, /✅ Agendamento confirmado!/);
  assert.match(msg, /avaliação de Lucas será em sex, 30\/10 às 14h30, com Dra\. Bia\./);
  assert.match(msg, /Chegue 15 minutos antes/);
  assert.match(msg, /FaçaAmigos - Centro de Terapia Comportamental$/);
});

test("remarcação avisa que a data mudou", () => {
  const msg = buildEvaluationRescheduleMessage({
    guardianFirstName: "Ana",
    patientName: "Lucas",
    formattedDate: "sex, 30/10 às 14h30",
    therapistName: "Dra. Bia",
  });
  assert.match(msg, /alterada/);
  assert.doesNotMatch(msg, /confirmado/);
});

test("mensagem única = confirmação + convite da pré-anamnese, sem repetir orientações", () => {
  const params = { guardianFirstName: "Ana", patientName: "Bia", formattedDate: "sex, 30/10 às 14h30", therapistName: "Dra. Clara" };
  const bundle = buildEvaluationBundleMessage(params);
  const confirmation = buildEvaluationConfirmationMessage(params);
  // Mesmo começo da confirmação (até as orientações), com o convite antes da assinatura.
  const confirmationBody = confirmation.slice(0, confirmation.lastIndexOf("\n\nFaçaAmigos"));
  assert.ok(bundle.startsWith(confirmationBody));
  assert.ok(bundle.includes("5 perguntas rápidas"));
  assert.ok(bundle.endsWith("FaçaAmigos - Centro de Terapia Comportamental"));
  assert.equal(bundle.split("15 minutos").length - 1, 1);
});

test("o corpo do template único no script de criação é idêntico ao texto enviado", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../scripts/create-eval-offer-template.ts", import.meta.url), "utf8");
  const match = source.match(/const BUNDLE_BODY =([\s\S]*?);\n\n/);
  assert.ok(match, "BUNDLE_BODY não encontrado");
  const body = eval(match[1].replace("BRAND_LINE", '"FaçaAmigos - Centro de Terapia Comportamental"')) as string;
  const filled = body.replace("{{1}}", "Ana").replace("{{2}}", "Bia").replace("{{3}}", "sex, 30/10 às 14h30").replace("{{4}}", "Dra. Clara");
  assert.equal(
    filled,
    buildEvaluationBundleMessage({ guardianFirstName: "Ana", patientName: "Bia", formattedDate: "sex, 30/10 às 14h30", therapistName: "Dra. Clara" }),
  );
});
