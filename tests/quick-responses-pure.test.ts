// tests/quick-responses-pure.test.ts
//
// Respostas rápidas do campo de mensagem: filtro, navegação por teclado e a regra de que o
// Enter NUNCA envia "/atalho" ao paciente.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideEnterKey,
  filterQuickResponses,
  isShortcutDraft,
  moveActiveIndex,
} from "../lib/atendimento/quick-responses-pure.ts";

const rows = [
  { id: "1", shortcut: "/endereco", title: "Endereço da clínica", contentText: "Rua A" },
  { id: "2", shortcut: "/horario", title: "Horário de funcionamento", contentText: "8h" },
  { id: "3", shortcut: "/convenio", title: "Convênios aceitos", contentText: "Unimed" },
];

test("rascunho de atalho: começa com / e não tem espaço", () => {
  assert.equal(isShortcutDraft("/"), true);
  assert.equal(isShortcutDraft("/end"), true);
  assert.equal(isShortcutDraft("/end "), false);
  assert.equal(isShortcutDraft("/end ereço"), false);
  assert.equal(isShortcutDraft("oi /end"), false);
  assert.equal(isShortcutDraft(""), false);
  assert.equal(isShortcutDraft("/a\nb"), false);
});

test("filtro: atalho começa com o texto OU título contém", () => {
  assert.deepEqual(filterQuickResponses(rows, "/").map((r) => r.id), ["1", "2", "3"]);
  assert.deepEqual(filterQuickResponses(rows, "/end").map((r) => r.id), ["1"]);
  // O título também conta: "funcionamento" contém "en".
  assert.deepEqual(filterQuickResponses(rows, "/en").map((r) => r.id), ["1", "2"]);
  assert.deepEqual(filterQuickResponses(rows, "/ACEITOS").map((r) => r.id), ["3"]);
  assert.deepEqual(filterQuickResponses(rows, "/zzz"), []);
});

test("setas navegam com volta ao início e ao fim", () => {
  assert.equal(moveActiveIndex(0, 1, 3), 1);
  assert.equal(moveActiveIndex(2, 1, 3), 0);
  assert.equal(moveActiveIndex(0, -1, 3), 2);
  assert.equal(moveActiveIndex(1, -1, 3), 0);
});

test("lista vazia: índice fica em 0", () => {
  assert.equal(moveActiveIndex(0, 1, 0), 0);
  assert.equal(moveActiveIndex(0, -1, 0), 0);
});

test("índice fora do alcance (lista encolheu ao filtrar) volta a ficar válido", () => {
  assert.equal(moveActiveIndex(5, 0, 2), 1);
});

test("Enter com atalho e resultado: escolhe o item, não envia", () => {
  assert.equal(decideEnterKey({ draft: "/end", matches: 1, shiftKey: false, composing: false }), "select");
});

test("Enter com atalho SEM resultado: não envia '/abc' ao paciente", () => {
  assert.equal(decideEnterKey({ draft: "/abc", matches: 0, shiftKey: false, composing: false }), "ignore");
  assert.equal(decideEnterKey({ draft: "/", matches: 0, shiftKey: false, composing: false }), "ignore");
});

test("Enter em mensagem normal envia; Shift+Enter e composição IME não", () => {
  assert.equal(decideEnterKey({ draft: "Olá, tudo bem?", matches: 0, shiftKey: false, composing: false }), "send");
  assert.equal(decideEnterKey({ draft: "Olá", matches: 0, shiftKey: true, composing: false }), "newline");
  assert.equal(decideEnterKey({ draft: "Olá", matches: 0, shiftKey: false, composing: true }), "newline");
});

test("mensagem que começa com / mas já tem frase (espaço) é mensagem normal", () => {
  assert.equal(decideEnterKey({ draft: "/endereço fica na Rua A", matches: 0, shiftKey: false, composing: false }), "send");
});
