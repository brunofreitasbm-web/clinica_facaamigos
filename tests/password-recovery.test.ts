// tests/password-recovery.test.ts
//
// Chamada do "esqueci minha senha" (lib/password-recovery.ts) com fetch simulado: o que vai no corpo e como
// a resposta do servidor vira mensagem. A regra de segurança fica na função recuperar-senha.
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestRecoveryCode, resetPasswordWithCode } from "../lib/password-recovery.ts";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("pede o código para a Clínica com o identificador sem espaços", async () => {
  const { impl, calls } = fakeFetch(200, { challenge_id: "abc", mensagem: "enviado" });
  const r = await requestRecoveryCode("  529.982.247-25 ", impl);
  assert.deepEqual(calls[0].body, { action: "pedir", sistema: "clinica", identificador: "529.982.247-25" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.challenge_id, "abc");
});

test("redefinir manda só dígitos do código e a senha nova", async () => {
  const { impl, calls } = fakeFetch(200, { ok: true });
  const r = await resetPasswordWithCode("id-1", "123 456", "Forte@123", impl);
  assert.deepEqual(calls[0].body, { action: "redefinir", challenge_id: "id-1", code: "123456", new_password: "Forte@123" });
  assert.equal(r.ok, true);
});

test("erro do servidor vira mensagem, e 'reiniciar' pede recomeçar", async () => {
  const { impl } = fakeFetch(401, { error: "código expirado, comece de novo", reiniciar: true });
  const r = await resetPasswordWithCode("id-1", "000000", "Forte@123", impl);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.error, "código expirado, comece de novo");
  assert.equal(!r.ok && r.restart, true);
});

test("sem rede devolve mensagem amigável", async () => {
  const impl = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  const r = await requestRecoveryCode("a@b.com", impl);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : "", /Sem conexão/);
});
