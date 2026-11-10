// tests/undo-toast-pure.test.ts
//
// Aviso com "Desfazer" (8 s) da Fila de entrada: aparece, expira, é substituído e nunca desfaz outro caso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { UNDO_SECONDS, canUndo, toastReducer, type ToastState } from "../app/recepcao/fila/undo-toast-pure.ts";

const T0 = 1_000_000;
const show = (id: number, draftId: string, now = T0) => toastReducer(null, { type: "show", id, draftId, message: "Guia marcada como enviada.", now });

test("mostra o aviso aberto por 8 segundos", () => {
  const s = show(1, "a");
  assert.equal(UNDO_SECONDS, 8);
  assert.ok(s);
  assert.equal(s.phase, "open");
  assert.equal(s.expiresAt, T0 + 8000);
  assert.equal(canUndo(s, 1, "a", T0 + 7999), true);
});

test("expira depois de 8 segundos e o desfazer passa a ser ignorado", () => {
  const s = show(1, "a");
  assert.equal(toastReducer(s, { type: "tick", now: T0 + 7999 }), s);
  assert.equal(toastReducer(s, { type: "tick", now: T0 + 8000 }), null);
  assert.equal(canUndo(s, 1, "a", T0 + 8000), false);
  assert.equal(toastReducer(s, { type: "undo_start", id: 1, draftId: "a", now: T0 + 8001 }), s);
});

test("ação mais nova substitui o aviso anterior; o desfazer do antigo é ignorado", () => {
  const first = show(1, "a");
  const second = toastReducer(first, { type: "show", id: 2, draftId: "b", message: "Plano negou registrado.", now: T0 + 3000 });
  assert.ok(second);
  assert.equal(second.id, 2);
  assert.equal(second.expiresAt, T0 + 11000);
  assert.equal(canUndo(second, 1, "a", T0 + 3001), false);
  assert.equal(toastReducer(second, { type: "undo_start", id: 1, draftId: "a", now: T0 + 3001 }), second);
});

test("desfazer com outro caso (draftId diferente) é ignorado", () => {
  const s = show(1, "a");
  assert.equal(canUndo(s, 1, "b", T0 + 10), false);
  assert.equal(toastReducer(s, { type: "undo_start", id: 1, draftId: "b", now: T0 + 10 }), s);
});

test("desfazer: abre, não expira enquanto roda e mostra o resultado", () => {
  const s = show(1, "a");
  const undoing = toastReducer(s, { type: "undo_start", id: 1, draftId: "a", now: T0 + 100 });
  assert.equal(undoing?.phase, "undoing");
  assert.equal(toastReducer(undoing, { type: "tick", now: T0 + 60_000 }), undoing);
  // não dá para desfazer duas vezes
  assert.equal(toastReducer(undoing, { type: "undo_start", id: 1, draftId: "a", now: T0 + 200 }), undoing);
  const done = toastReducer(undoing, { type: "undo_result", id: 1, ok: true, message: "Desfeito.", now: T0 + 500 });
  assert.equal(done?.phase, "undone");
  assert.equal(done?.expiresAt, T0 + 8500);
  const failed = toastReducer(undoing, { type: "undo_result", id: 1, ok: false, message: "Erro", now: T0 + 500 });
  assert.equal(failed?.phase, "error");
  // resultado de um aviso já substituído não mexe no novo
  const replaced: ToastState = toastReducer(undoing, { type: "show", id: 2, draftId: "b", message: "x", now: T0 + 300 });
  assert.equal(toastReducer(replaced, { type: "undo_result", id: 1, ok: true, message: "Desfeito.", now: T0 + 500 }), replaced);
});

test("fechar só fecha o próprio aviso", () => {
  const s = show(2, "a");
  assert.equal(toastReducer(s, { type: "dismiss", id: 1 }), s);
  assert.equal(toastReducer(s, { type: "dismiss", id: 2 }), null);
});
