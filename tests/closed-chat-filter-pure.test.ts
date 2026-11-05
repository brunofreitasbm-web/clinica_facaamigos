import test from "node:test";
import assert from "node:assert/strict";
import { isHiddenByClosedChat, phonesWithOnlyClosedChats } from "../lib/closed-chat-filter-pure.ts";

const draft = (over: Partial<{ sourcePhone: string | null; authorization: string; returned: unknown }> = {}) => ({
  sourcePhone: "+5511999990000",
  pipeline: { authorization: over.authorization ?? "pendente", returned: over.returned ?? null },
  ...(over.sourcePhone !== undefined ? { sourcePhone: over.sourcePhone } : {}),
});

test("só conta telefone com todas as conversas encerradas", () => {
  const set = phonesWithOnlyClosedChats([
    { phone_number: "A", status: "closed" },
    { phone_number: "B", status: "closed" },
    { phone_number: "B", status: "open" },
    { phone_number: "C", status: "pending" },
    { phone_number: null, status: "closed" },
  ]);
  assert.deepEqual([...set], ["A"]);
});

test("esconde lead sem andamento de guia com chat encerrado", () => {
  assert.equal(isHiddenByClosedChat(draft(), new Set(["+5511999990000"])), true);
});

test("mantém lead com guia enviada, autorizada, dispensada ou devolvido", () => {
  const closed = new Set(["+5511999990000"]);
  for (const authorization of ["enviada", "autorizada", "dispensada"]) {
    assert.equal(isHiddenByClosedChat(draft({ authorization }), closed), false);
  }
  assert.equal(isHiddenByClosedChat(draft({ returned: { at: "x" } }), closed), false);
});

test("mantém lead sem chat encerrado ou sem telefone", () => {
  assert.equal(isHiddenByClosedChat(draft(), new Set()), false);
  assert.equal(isHiddenByClosedChat(draft({ sourcePhone: null }), new Set(["+5511999990000"])), false);
  assert.equal(isHiddenByClosedChat(null, new Set(["x"])), false);
});
