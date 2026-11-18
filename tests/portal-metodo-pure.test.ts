import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAnamneseRealizada,
  childFirstNameOrFallback,
  shouldShowMetodo,
  pickNextVisit,
  welcomeCouponValidOnWeekday,
  buildTurnoWhatsappLink,
} from "../lib/portal-metodo-pure.ts";

test("anamnese realizada: só evaluated_at ou status realizada; agendada não conta", () => {
  assert.equal(isAnamneseRealizada({ evaluated_at: "2026-11-10T12:00:00Z" }, []), true);
  assert.equal(isAnamneseRealizada({ evaluated_at: null }, ["realizada"]), true);
  assert.equal(isAnamneseRealizada({ evaluated_at: null }, ["agendada", "confirmada"]), false);
  assert.equal(isAnamneseRealizada(null, []), false);
});

test("primeiro nome com fallback", () => {
  assert.equal(childFirstNameOrFallback("Davi Átila Souza"), "Davi");
  assert.equal(childFirstNameOrFallback("  "), "seu filho(a)");
  assert.equal(childFirstNameOrFallback(null), "seu filho(a)");
});

test("Método aparece sem série ou com série em aberto; some quando concluída/cancelada", () => {
  assert.equal(shouldShowMetodo({ anamneseRealizada: false, seriesStatuses: [] }), false);
  assert.equal(shouldShowMetodo({ anamneseRealizada: true, seriesStatuses: [] }), true);
  assert.equal(shouldShowMetodo({ anamneseRealizada: true, seriesStatuses: ["liberada"] }), true);
  assert.equal(shouldShowMetodo({ anamneseRealizada: true, seriesStatuses: ["rascunho"] }), true);
  assert.equal(shouldShowMetodo({ anamneseRealizada: true, seriesStatuses: ["concluida"] }), false);
  assert.equal(shouldShowMetodo({ anamneseRealizada: true, seriesStatuses: ["cancelada", "concluida"] }), false);
});

test("próxima visita ignora cancelada e passada, pega a mais cedo", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const v = [
    { scheduled_start: "2026-11-17T12:00:00Z", cancelled_at: null },
    { scheduled_start: "2026-11-20T12:00:00Z", cancelled_at: "2026-11-19T00:00:00Z" },
    { scheduled_start: "2026-11-25T12:00:00Z", cancelled_at: null },
    { scheduled_start: "2026-11-23T12:00:00Z", cancelled_at: null },
  ];
  assert.equal(pickNextVisit(v, now)?.scheduled_start, "2026-11-23T12:00:00Z");
  assert.equal(pickNextVisit([], now), null);
});

test("cupom de boas-vindas: segunda a quinta", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(welcomeCouponValidOnWeekday), [true, true, true, true, false, false, false]);
});

test("link do turno vai para o WhatsApp da clínica com o nome da criança", () => {
  const link = buildTurnoWhatsappLink("Davi");
  assert.ok(link.startsWith("https://wa.me/5591991782027?text="));
  assert.ok(decodeURIComponent(link).includes("Davi"));
});
