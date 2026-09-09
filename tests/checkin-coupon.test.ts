// tests/checkin-coupon.test.ts
//
// buildCouponModel (lib/checkin-coupon.ts) é a única fonte de formatação do
// cupom de check-in — testar sem banco garante que toggles, ordenação e
// dedupe de avisos não regridam silenciosamente.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCouponModel,
  DEFAULT_COUPON_SETTINGS,
  type CouponInput,
  type CouponSettings,
} from "../lib/checkin-coupon.ts";
import { renderCouponBody, renderCouponDocument } from "../lib/checkin-coupon-html.ts";

const TZ = "America/Sao_Paulo";

function baseInput(overrides: Partial<CouponInput> = {}): CouponInput {
  return {
    clinicName: "FaçaAmigos",
    patientName: "João Pedro",
    serviceDate: "2026-09-09",
    checkinAt: "2026-09-09T13:32:00.000Z",
    ticketLabel: "Q012",
    printedAt: "2026-09-09T13:32:05.000Z",
    logoUrl: "/brand/facaamigos-horizontal-sem-assinatura.svg",
    sessions: [
      {
        startsAt: "2026-09-09T16:30:00.000Z", // 13:30 em -03:00
        endsAt: "2026-09-09T17:15:00.000Z",
        roomName: "Sala 2",
        disciplineLabel: "Psicologia ABA",
        therapistName: "Ana Beatriz",
      },
      {
        startsAt: "2026-09-09T14:00:00.000Z", // 11:00 em -03:00 — vem antes na ordenação
        endsAt: "2026-09-09T14:45:00.000Z",
        roomName: "Sala 4",
        disciplineLabel: "Fonoaudiologia",
        therapistName: "Carlos Eduardo",
      },
    ],
    ...overrides,
  };
}

test("ordena as sessões por horário de início, não pela ordem de entrada", () => {
  const model = buildCouponModel(baseInput(), DEFAULT_COUPON_SETTINGS, TZ);
  assert.equal(model.lines.length, 2);
  assert.match(model.lines[0].timeRange ?? "", /^11:00/);
  assert.match(model.lines[1].timeRange ?? "", /^13:30/);
});

test("toggles desligados removem o campo correspondente do modelo", () => {
  const settings: CouponSettings = { ...DEFAULT_COUPON_SETTINGS, showTherapist: false, showRoom: false, showTicketLabel: false };
  const model = buildCouponModel(baseInput(), settings, TZ);
  assert.equal(model.ticketLabel, null);
  for (const line of model.lines) {
    assert.equal(line.therapistName, null);
    assert.equal(line.roomName, null);
  }
});

test("avisos duplicados (mesmo texto em duas sessões) aparecem uma única vez", () => {
  const input = baseInput({
    sessions: [
      { startsAt: "2026-09-09T14:00:00.000Z", endsAt: "2026-09-09T14:45:00.000Z", roomName: "Sala 1", disciplineLabel: "TO", therapistName: "A", warning: "Sessão sem guia de convênio vinculada." },
      { startsAt: "2026-09-09T16:00:00.000Z", endsAt: "2026-09-09T16:45:00.000Z", roomName: "Sala 2", disciplineLabel: "TO", therapistName: "B", warning: "Sessão sem guia de convênio vinculada." },
    ],
  });
  const model = buildCouponModel(input, DEFAULT_COUPON_SETTINGS, TZ);
  assert.deepEqual(model.warnings, ["Sessão sem guia de convênio vinculada."]);
});

test("showWarnings=false esconde os avisos mesmo que existam", () => {
  const input = baseInput({
    sessions: [{ startsAt: "2026-09-09T14:00:00.000Z", endsAt: "2026-09-09T14:45:00.000Z", roomName: "Sala 1", disciplineLabel: "TO", therapistName: "A", warning: "Guia vencida." }],
  });
  const settings: CouponSettings = { ...DEFAULT_COUPON_SETTINGS, showWarnings: false };
  const model = buildCouponModel(input, settings, TZ);
  assert.deepEqual(model.warnings, []);
});

test("data no formato brasileiro (DD/MM/AAAA)", () => {
  const model = buildCouponModel(baseInput({ serviceDate: "2026-01-05" }), DEFAULT_COUPON_SETTINGS, TZ);
  assert.equal(model.dateLabel, "05/01/2026");
});

test("cabeçalho/rodapé com & e < é escapado no HTML renderizado", () => {
  const input = baseInput({});
  const settings: CouponSettings = { ...DEFAULT_COUPON_SETTINGS, headerText: "Tom & Jerry <VIP>" };
  const model = buildCouponModel(input, settings, TZ);
  const html = renderCouponBody(model);
  assert.ok(html.includes("Tom &amp; Jerry &lt;VIP&gt;"));
  assert.ok(!html.includes("<VIP>"));
});

test("renderCouponDocument inclui @page com a largura configurada", () => {
  const model = buildCouponModel(baseInput(), { ...DEFAULT_COUPON_SETTINGS, paperWidthMm: 58 }, TZ);
  const doc = renderCouponDocument(model);
  assert.ok(doc.includes("@page { size: 58mm auto; margin: 0; }"));
});

test("paciente sem sessões ainda produz um modelo (lines vazio) sem lançar", () => {
  const model = buildCouponModel(baseInput({ sessions: [] }), DEFAULT_COUPON_SETTINGS, TZ);
  assert.deepEqual(model.lines, []);
});
