import { test } from "node:test";
import assert from "node:assert/strict";
import { isPhoneFreeForOffer, STALE_SESSION_MS } from "../lib/evaluation-offer-session-pure.ts";

const now = Date.parse("2026-10-30T11:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

test("sem sessão, idle e fluxo da própria oferta: livre", () => {
  assert.equal(isPhoneFreeForOffer(null, "eval_offer", now), true);
  assert.equal(isPhoneFreeForOffer({ current_step: "idle", flow: null, updated_at: ago(0) }, "eval_offer", now), true);
  assert.equal(isPhoneFreeForOffer({ current_step: "x", flow: "eval_offer", updated_at: ago(0) }, "eval_offer", now), true);
});

test("outro fluxo recente: ocupado; parado há mais de 24h: livre", () => {
  const s = (age: number) => ({ current_step: "awaiting_slot_selection", flow: null, updated_at: ago(age) });
  assert.equal(isPhoneFreeForOffer(s(20 * 3600_000), "eval_offer", now), false);
  assert.equal(isPhoneFreeForOffer(s(STALE_SESSION_MS + 1), "eval_offer", now), true);
});

test("sem updated_at válido: ocupado (não arrisca atropelar conversa)", () => {
  assert.equal(isPhoneFreeForOffer({ current_step: "awaiting_laudo", flow: null, updated_at: null }, "eval_offer", now), false);
});
