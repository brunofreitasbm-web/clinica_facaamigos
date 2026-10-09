// tests/back-handler.test.ts
//
// Motor do botão "voltar" (lib/back-handler.ts) contra um histórico falso que
// imita o do navegador: pushState trunca o "avançar" e go()/back() disparam
// popstate de forma assíncrona. Não substitui um teste em celular real.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createBackOwner, resetBackHandlerForTests } from "../lib/back-handler.ts";

type PopListener = (e: { state: unknown }) => void;

function criarJanela() {
  const stack: { state: unknown }[] = [{ state: null }];
  let idx = 0;
  const ouvintes: PopListener[] = [];
  const w = {
    history: {
      get state() { return stack[idx].state; },
      get length() { return stack.length; },
      pushState(state: unknown) { stack.splice(idx + 1); stack.push({ state }); idx += 1; },
      go(n: number) {
        const alvo = idx + n;
        if (alvo < 0 || alvo >= stack.length) return;
        setTimeout(() => { idx = alvo; ouvintes.slice().forEach(f => { try { f({ state: stack[idx].state }); } catch (e) { w.errosListener.push(e); } }); }, 0);
      },
      back() { this.go(-1); },
    },
    addEventListener(tipo: string, f: PopListener) { if (tipo === "popstate") ouvintes.push(f); },
    removeEventListener(tipo: string, f: PopListener) { const i = ouvintes.indexOf(f); if (i >= 0) ouvintes.splice(i, 1); },
    errosListener: [] as unknown[],
    _idx: () => idx,
    _len: () => stack.length,
  };
  return w;
}

const esperar = (ms = 15) => new Promise((r) => setTimeout(r, ms));
let w: ReturnType<typeof criarJanela>;

beforeEach(() => {
  resetBackHandlerForTests();
  w = criarJanela();
  (globalThis as unknown as { window: unknown }).window = w;
});

test("cada nível vira uma entrada e voltar desfaz um por vez", async () => {
  let niveis = 0;
  const h = createBackOwner({ getDepth: () => niveis, onBack: () => { niveis -= 1; h.sync(); } });
  niveis = 2; h.sync();
  assert.equal(w._len(), 3);
  w.history.back(); await esperar();
  assert.equal(niveis, 1);
  w.history.back(); await esperar();
  assert.equal(niveis, 0);
  assert.equal(w._idx(), 0);
});

test("na raiz nada é empilhado", () => {
  const h = createBackOwner({ getDepth: () => 0, onBack: () => {} });
  h.sync();
  assert.equal(w._len(), 1);
});

test("fechar pela tela remove as entradas sem chamar onBack", async () => {
  let niveis = 0;
  let chamadas = 0;
  const h = createBackOwner({ getDepth: () => niveis, onBack: () => { chamadas += 1; } });
  niveis = 2; h.sync();
  niveis = 0; h.sync(); await esperar(30);
  assert.equal(chamadas, 0);
  assert.equal(w._idx(), 0);
});

test("onBack que não reduz o depth repõe a entrada", async () => {
  const niveis = 1;
  const h = createBackOwner({ getDepth: () => niveis, onBack: () => {} });
  h.sync();
  w.history.back(); await esperar(30);
  assert.equal(w._idx(), 1, "entrada reposta");
});

test("se algo navegou por cima, não usa history.go para limpar", async () => {
  let niveis = 1;
  const h = createBackOwner({ getDepth: () => niveis, onBack: () => {} });
  h.sync();
  w.history.pushState({ rota: "outra" });
  niveis = 0; h.sync(); await esperar(30);
  assert.deepEqual(w.history.state, { rota: "outra" });
});

test("preserva o state anterior ao empilhar", () => {
  w.history.pushState({ outro: 1 });
  const h = createBackOwner({ getDepth: () => 1, onBack: () => {} });
  h.sync();
  assert.equal((w.history.state as Record<string, unknown>).outro, 1);
  assert.ok((w.history.state as Record<string, unknown>).__backHandler);
});

test("onBack que lança erro ainda repõe a entrada (ressincroniza)", async () => {
  createBackOwner({ getDepth: () => 1, onBack: () => { throw new Error("falhou"); } });
  w.history.back();
  await esperar(40);
  assert.equal(w._idx(), 1, "entrada reposta mesmo com erro");
  assert.equal(w.errosListener.length, 1);
});
