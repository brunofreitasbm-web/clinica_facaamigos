// tests/evaluation-confirmation-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
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

test("o corpo do template de abertura no script é idêntico ao texto do app", async () => {
  const { readFileSync } = await import("node:fs");
  const { CONTACT_OPENER_MESSAGE } = await import("../lib/contact-opener-pure.ts");
  const source = readFileSync(new URL("../scripts/create-eval-offer-template.ts", import.meta.url), "utf8");
  const match = source.match(/const OPENER_BODY =([\s\S]*?);\n\n/);
  assert.ok(match, "OPENER_BODY não encontrado");
  const body = eval(match[1].replace("BRAND_LINE", '"FaçaAmigos - Centro de Terapia Comportamental"')) as string;
  assert.equal(body, CONTACT_OPENER_MESSAGE);
});
