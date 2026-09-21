// tests/business-hours-pure.test.ts
//
// Grade de horário comercial (lib/business-hours-pure.ts) virando o texto que
// o chatbot do WhatsApp usa ao avisar que a recepção responde em horário
// comercial. Grade vazia tem que devolver "" — o bot nunca inventa horário.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBusinessHours } from "../lib/business-hours-pure.ts";

test("agrupa dias consecutivos com o mesmo horário", () => {
  const rows = [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: "08:00:00", close_time: "18:00:00" }));
  rows.push({ day_of_week: 6, open_time: "08:00:00", close_time: "12:00:00" });
  assert.equal(
    formatBusinessHours(rows),
    "segunda a sexta, das 08h às 18h; sábado, das 08h às 12h",
  );
});

test("dia isolado, par de dias e minutos quebrados", () => {
  assert.equal(
    formatBusinessHours([{ day_of_week: 3, open_time: "13:30:00", close_time: "17:00:00" }]),
    "quarta, das 13h30 às 17h",
  );
  assert.equal(
    formatBusinessHours([
      { day_of_week: 1, open_time: "08:00:00", close_time: "18:00:00" },
      { day_of_week: 2, open_time: "08:00:00", close_time: "18:00:00" },
    ]),
    "segunda e terça, das 08h às 18h",
  );
});

test("dias não consecutivos com o mesmo horário não são agrupados", () => {
  assert.equal(
    formatBusinessHours([
      { day_of_week: 1, open_time: "08:00:00", close_time: "12:00:00" },
      { day_of_week: 3, open_time: "08:00:00", close_time: "12:00:00" },
    ]),
    "segunda, das 08h às 12h; quarta, das 08h às 12h",
  );
});

test("grade não cadastrada devolve string vazia", () => {
  assert.equal(formatBusinessHours([]), "");
});
