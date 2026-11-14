// tests/falta-quick-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFaltaFormData, reasonNeedsDetail, DEFAULT_NEGATIVE_STATUS } from "../lib/falta-quick-pure.ts";
import { NEGATIVE_STATUSES } from "../lib/appointment-cancel-reasons.ts";

test("o status padrão é um status negativo válido (falta da família)", () => {
  assert.equal(DEFAULT_NEGATIVE_STATUS, "falta_familia");
  assert.ok(NEGATIVE_STATUSES.some((s) => s.value === DEFAULT_NEGATIVE_STATUS));
});

test("padrão + motivo comum monta o envio sem texto livre (2 cliques)", () => {
  const r = buildFaltaFormData({ status: DEFAULT_NEGATIVE_STATUS, reason: "transporte" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.formData.get("target_status"), "falta_familia");
    assert.equal(r.formData.get("reason"), "transporte");
    assert.equal(r.formData.get("reason_other"), null);
  }
});

test("'Outro' exige descrição; com descrição envia o texto aparado", () => {
  assert.ok(reasonNeedsDetail("outro"));
  assert.ok(!reasonNeedsDetail("viagem"));
  const vazio = buildFaltaFormData({ status: "falta_familia", reason: "outro", detail: "   " });
  assert.ok(!vazio.ok);
  const ok = buildFaltaFormData({ status: "falta_familia", reason: "outro", detail: "  Mudou de cidade " });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.formData.get("reason_other"), "Mudou de cidade");
});

test("status ou motivo fora da lista fechada são recusados com mensagem para o operador", () => {
  const s = buildFaltaFormData({ status: "xyz", reason: "viagem" });
  const m = buildFaltaFormData({ status: "falta_familia", reason: "xyz" });
  assert.ok(!s.ok && !m.ok);
  if (!s.ok) assert.match(s.error, /o que aconteceu/);
  if (!m.ok) assert.match(m.error, /motivo/);
});
