// tests/hub-sync.test.ts
//
// cabecalhosSincronizacaoHub (lib/hub-sync.ts) monta os headers da chamada do login da Clínica para
// sincronizar_login_clinica no Hub de Gestão: o segredo compartilhado (GESTAO_SYNC_SECRET) e o IP real
// do usuário só vão quando o segredo está configurado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cabecalhosSincronizacaoHub } from "../lib/hub-sync.ts";

test("sem segredo: só Content-Type", () => {
  assert.deepEqual(cabecalhosSincronizacaoHub(undefined, "1.2.3.4"), { "Content-Type": "application/json" });
  assert.deepEqual(cabecalhosSincronizacaoHub("", "1.2.3.4"), { "Content-Type": "application/json" });
});

test("com segredo: envia o header do segredo", () => {
  const h = cabecalhosSincronizacaoHub("s3gr3do", null);
  assert.equal(h["x-gestao-sync-secret"], "s3gr3do");
  assert.equal(h["Content-Type"], "application/json");
});

test("com segredo e IP: pega o primeiro IP do x-forwarded-for", () => {
  const h = cabecalhosSincronizacaoHub("s3gr3do", " 1.2.3.4 , 10.0.0.1");
  assert.equal(h["x-cliente-ip"], "1.2.3.4");
});

test("com segredo e sem IP: não envia x-cliente-ip", () => {
  assert.equal("x-cliente-ip" in cabecalhosSincronizacaoHub("s3gr3do", null), false);
  assert.equal("x-cliente-ip" in cabecalhosSincronizacaoHub("s3gr3do", " , "), false);
});
