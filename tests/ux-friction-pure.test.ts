// tests/ux-friction-pure.test.ts
//
// Saneamento (privacidade) e detector de cliques repetidos do monitor de
// fricção (lib/ux-friction.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_EVENTS_PER_BATCH,
  RageClickDetector,
  normalizeRoute,
  sanitizeBatch,
  sanitizeSessionId,
  scrubLabel,
} from "../lib/ux-friction.ts";

test("normalizeRoute troca uuid, número e token por :id e remove query/hash", () => {
  assert.equal(
    normalizeRoute("/recepcao/pacientes/6f1c2a3b-1111-4222-8333-444455556666/editar?aba=2#topo"),
    "/recepcao/pacientes/:id/editar",
  );
  assert.equal(normalizeRoute("/gestor/contratos/123"), "/gestor/contratos/:id");
  assert.equal(normalizeRoute("/ficha/abc123def456ghi"), "/ficha/:id");
  assert.equal(normalizeRoute("/recepcao/agenda"), "/recepcao/agenda");
  assert.equal(normalizeRoute("/"), "/");
});

test("scrubLabel remove e-mail, CPF/telefone e limita o tamanho", () => {
  assert.equal(scrubLabel("maria@exemplo.com"), null);
  assert.equal(scrubLabel("Ligar 91 98888-7777"), "Ligar …");
  assert.equal(scrubLabel("CPF 123.456.789-00"), "CPF …");
  assert.equal(scrubLabel("Protocolo 20260929"), "Protocolo …");
  assert.equal(scrubLabel("   "), null);
  assert.equal(scrubLabel(42), null);
  assert.equal(scrubLabel("x".repeat(100))?.length, 40);
  assert.equal(scrubLabel("Salvar   guia"), "Salvar guia");
});

test("sanitizeBatch descarta tipo desconhecido, rota inválida e chaves fora da lista branca", () => {
  const rows = sanitizeBatch({
    events: [
      { type: "page_view", route: "/recepcao/agenda?x=1", detail: { dwell_ms: 1234.6, clicks: 3, valor_digitado: "segredo", field: "cpf" }, agoMs: 500 },
      { type: "keylog", route: "/x" },
      { type: "dead_click", route: "sem-barra" },
      { type: "dead_click", route: "/gestor", target: "Salvar", detail: { disabled: 1 } },
      null,
      "lixo",
    ],
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].detail, { dwell_ms: 1235, clicks: 3, field: "cpf" });
  assert.equal(rows[0].route, "/recepcao/agenda");
  assert.equal(rows[0].ago_ms, 500);
  assert.equal(rows[1].target, "Salvar");
  assert.deepEqual(rows[1].detail, { disabled: 1 });
});

test("sanitizeBatch limita o lote e tolera corpo inválido", () => {
  const many = Array.from({ length: 100 }, () => ({ type: "form_error", route: "/x" }));
  assert.equal(sanitizeBatch({ events: many }).length, MAX_EVENTS_PER_BATCH);
  assert.deepEqual(sanitizeBatch(null), []);
  assert.deepEqual(sanitizeBatch({ events: "nope" }), []);
});

test("números negativos, NaN e absurdos são limitados ou descartados", () => {
  const [row] = sanitizeBatch({
    events: [{ type: "page_view", route: "/x", detail: { dwell_ms: -5, clicks: "abc", ttfa_ms: 99999999999 }, agoMs: 9e12 }],
  });
  assert.deepEqual(row.detail, { ttfa_ms: 6 * 60 * 60 * 1000 });
  assert.equal(row.ago_ms, 60 * 60 * 1000);
});

test("sanitizeSessionId aceita só uuid/hex curto", () => {
  assert.equal(sanitizeSessionId("6f1c2a3b-1111-4222-8333-444455556666"), "6f1c2a3b-1111-4222-8333-444455556666");
  assert.equal(sanitizeSessionId("a b; drop table"), null);
  assert.equal(sanitizeSessionId("curto"), null);
  assert.equal(sanitizeSessionId(undefined), null);
});

test("RageClickDetector dispara no 3º clique rápido no mesmo ponto e respeita o cooldown", () => {
  const d = new RageClickDetector();
  assert.equal(d.record(0, 100, 100), false);
  assert.equal(d.record(200, 102, 101), false);
  assert.equal(d.record(400, 99, 100), true);
  // surto continua: não dispara de novo dentro do cooldown
  assert.equal(d.record(500, 100, 100), false);
  assert.equal(d.record(600, 100, 100), false);
  assert.equal(d.record(700, 100, 100), false);
});

test("RageClickDetector ignora cliques lentos ou em pontos diferentes", () => {
  const slow = new RageClickDetector();
  assert.equal(slow.record(0, 10, 10), false);
  assert.equal(slow.record(1500, 10, 10), false);
  assert.equal(slow.record(3000, 10, 10), false);

  const apart = new RageClickDetector();
  assert.equal(apart.record(0, 10, 10), false);
  assert.equal(apart.record(100, 300, 300), false);
  assert.equal(apart.record(200, 600, 100), false);
});
