// tests/recadastro.test.ts
//
// Recadastro de identidade (CPF + e-mail real) integrado ao Hub de Gestão. A Clínica não é a autoridade:
// o cookie fa_recad é só otimização de UX, e qualquer falha do Hub significa "não bloquear".
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  consultarStatusRecadastro,
  cookieDoStatus,
  decidirDestinoRecadastro,
  decidirRedirecionamentoRecadastro,
  pedirTicketRecadastro,
  urlDoHubValida,
} from "../lib/recadastro.ts";

const resposta = (corpo: unknown, status = 200) =>
  (async () => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status })) as typeof fetch;

afterEach(() => {
  delete process.env.GESTAO_RECADASTRO;
});

test("chave_desligada_devolve_null", async () => {
  let chamadas = 0;
  const f = (async () => {
    chamadas++;
    return new Response("{}");
  }) as typeof fetch;
  assert.equal(await consultarStatusRecadastro("tok", f), null);
  process.env.GESTAO_RECADASTRO = "0";
  assert.equal(await consultarStatusRecadastro("tok", f), null);
  assert.equal(await pedirTicketRecadastro("tok", f), null);
  assert.equal(chamadas, 0);
});

test("chave_ligada_e_lida_a_cada_chamada", async () => {
  const f = resposta({ pendente: true, bloquear: false, dias_restantes: 3 });
  assert.equal(await consultarStatusRecadastro("tok", f), null);
  process.env.GESTAO_RECADASTRO = "1";
  assert.deepEqual(await consultarStatusRecadastro("tok", f), { pendente: true, bloquear: false, dias_restantes: 3 });
  delete process.env.GESTAO_RECADASTRO;
  assert.equal(await consultarStatusRecadastro("tok", f), null);
});

test("consulta envia action, sistema e Bearer", async () => {
  process.env.GESTAO_RECADASTRO = "1";
  let visto: { url: string; init: RequestInit } | null = null;
  const f = (async (url: string, init: RequestInit) => {
    visto = { url, init };
    return new Response(JSON.stringify({ pendente: false, bloquear: false, dias_restantes: 7 }));
  }) as unknown as typeof fetch;
  await consultarStatusRecadastro("meu-token", f);
  assert.equal(visto!.url, "https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/gestao-hub");
  assert.equal(visto!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(visto!.init.body)), { action: "recadastro_status", sistema: "clinica" });
  assert.equal((visto!.init.headers as Record<string, string>).Authorization, "Bearer meu-token");
});

test("timeout_ou_erro_devolve_null", async () => {
  process.env.GESTAO_RECADASTRO = "1";
  assert.equal(await consultarStatusRecadastro("tok", resposta({ error: "x" }, 401)), null);
  assert.equal(await consultarStatusRecadastro("tok", resposta({ error: "x" }, 500)), null);
  assert.equal(await consultarStatusRecadastro("tok", resposta("<html>nao e json")), null);
  assert.equal(await consultarStatusRecadastro("tok", resposta({ pendente: "sim" })), null);
  assert.equal(await consultarStatusRecadastro("tok", resposta(null)), null);
  assert.equal(await consultarStatusRecadastro("", resposta({ pendente: false, bloquear: false, dias_restantes: 1 })), null);
  const cai = (async () => {
    throw new Error("rede");
  }) as typeof fetch;
  assert.equal(await consultarStatusRecadastro("tok", cai), null);
  // Timeout: o fetch só termina se o sinal abortar; a consulta precisa devolver null em ~3 s.
  const pendurado = ((_u: string, init: RequestInit) =>
    new Promise((_res, rej) => {
      init.signal?.addEventListener("abort", () => rej(new Error("abortado")));
    })) as unknown as typeof fetch;
  const t0 = Date.now();
  assert.equal(await consultarStatusRecadastro("tok", pendurado), null);
  const gasto = Date.now() - t0;
  assert.ok(gasto >= 2500 && gasto < 6000, `timeout fora do esperado: ${gasto} ms`);
});

test("cookie_do_status_mapeia", () => {
  assert.equal(cookieDoStatus(null), "ok");
  assert.equal(cookieDoStatus({ pendente: false, bloquear: false, dias_restantes: 7 }), "ok");
  assert.equal(cookieDoStatus({ pendente: false, bloquear: true, dias_restantes: 0 }), "ok");
  assert.equal(cookieDoStatus({ pendente: true, bloquear: false, dias_restantes: 4 }), "pendente");
  assert.equal(cookieDoStatus({ pendente: true, bloquear: true, dias_restantes: 0 }), "bloquear");
});

test("so_bloquear_redireciona", () => {
  assert.equal(decidirRedirecionamentoRecadastro("bloquear", "/gestor"), "recadastro");
  assert.equal(decidirRedirecionamentoRecadastro("bloquear", "/"), "recadastro");
  assert.equal(decidirRedirecionamentoRecadastro("pendente", "/gestor"), null);
  assert.equal(decidirRedirecionamentoRecadastro("ok", "/gestor"), null);
  assert.equal(decidirRedirecionamentoRecadastro(undefined, "/gestor"), null);
  assert.equal(decidirRedirecionamentoRecadastro("BLOQUEAR", "/gestor"), null);
  assert.equal(decidirRedirecionamentoRecadastro("qualquer-coisa", "/gestor"), null);
});

test("rotas_isentas_nunca_redirecionam", () => {
  for (const p of [
    "/recadastro",
    "/login",
    "/trocar-senha",
    "/checkin/abc",
    "/ficha/abc",
    "/api/webhooks/twilio",
    "/auth/sso",
    "/esqueci-senha",
    "/familia",
    "/familia/agenda",
  ]) {
    assert.equal(decidirRedirecionamentoRecadastro("bloquear", p), null, p);
  }
  // Prefixo parecido não é isenção.
  assert.equal(decidirRedirecionamentoRecadastro("bloquear", "/recadastros"), "recadastro");
  assert.equal(decidirRedirecionamentoRecadastro("bloquear", "/familiar"), "recadastro");
});

test("ticket_devolve_url_ou_null", async () => {
  process.env.GESTAO_RECADASTRO = "1";
  const url = "https://gestao.institutofacaamigos.com.br/#recadastro&c=abc";
  assert.equal(await pedirTicketRecadastro("tok", resposta({ url })), url);
  assert.equal(await pedirTicketRecadastro("tok", resposta({ pendente: false })), null);
  assert.equal(await pedirTicketRecadastro("tok", resposta({ error: "x" }, 403)), null);
  assert.equal(await pedirTicketRecadastro("tok", resposta("lixo")), null);
  assert.equal(await pedirTicketRecadastro("tok", resposta({ url: 42 })), null);
  const cai = (async () => {
    throw new Error("rede");
  }) as typeof fetch;
  assert.equal(await pedirTicketRecadastro("tok", cai), null);
});

test("ticket com host fora da lista vira null (sem open redirect)", async () => {
  process.env.GESTAO_RECADASTRO = "1";
  for (const url of [
    "https://evil.example.com/#recadastro&c=abc",
    "https://gestao.institutofacaamigos.com.br.evil.com/x",
    "http://gestao.institutofacaamigos.com.br/#recadastro&c=abc",
    "//gestao.institutofacaamigos.com.br/x",
    "javascript:alert(1)",
    "https://user@evil.com/",
  ]) {
    assert.equal(await pedirTicketRecadastro("tok", resposta({ url })), null, url);
  }
});

test("urlDoHubValida aceita o host padrao e o configurado", () => {
  assert.equal(urlDoHubValida("https://gestao.institutofacaamigos.com.br/#recadastro&c=1"), true);
  assert.equal(urlDoHubValida("https://outro.exemplo.com/x"), false);
  assert.equal(urlDoHubValida("https://outro.exemplo.com/x", "outro.exemplo.com"), true);
  assert.equal(urlDoHubValida("nao e url"), false);
});

test("decidirDestinoRecadastro: nunca deixa cookie bloquear com destino inicio (laco de redirects)", () => {
  const pend = { pendente: true, bloquear: true, dias_restantes: 0 };
  const hub = "https://gestao.institutofacaamigos.com.br/#recadastro&c=abc";
  // pendente sem ticket: fail-open, cookie ok e volta ao inicio
  assert.deepEqual(decidirDestinoRecadastro(pend, null, true), { destino: "inicio", cookie: "ok" });
  // sem token: fail-open
  assert.deepEqual(decidirDestinoRecadastro(pend, hub, false), { destino: "inicio", cookie: "ok" });
  // status null e nao pendente: ok
  assert.deepEqual(decidirDestinoRecadastro(null, null, true), { destino: "inicio", cookie: "ok" });
  assert.deepEqual(
    decidirDestinoRecadastro({ pendente: false, bloquear: false, dias_restantes: 7 }, hub, true),
    { destino: "inicio", cookie: "ok" },
  );
  // pendente com ticket: vai ao Hub, cookie reflete o status
  assert.deepEqual(decidirDestinoRecadastro(pend, hub, true), { destino: "hub", cookie: "bloquear", url: hub });
  assert.deepEqual(
    decidirDestinoRecadastro({ pendente: true, bloquear: false, dias_restantes: 3 }, hub, true),
    { destino: "hub", cookie: "pendente", url: hub },
  );
  // invariante: destino inicio nunca grava bloquear
  for (const st of [null, pend, { ...pend, bloquear: false }]) {
    for (const url of [null, hub]) {
      for (const tok of [true, false]) {
        const d = decidirDestinoRecadastro(st, url, tok);
        if (d.destino === "inicio") assert.equal(d.cookie, "ok");
      }
    }
  }
});
