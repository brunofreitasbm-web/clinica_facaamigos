// perf/intake-load.mjs
//
// Mede a abertura da Fila de entrada: carrega /recepcao/a-autorizar N vezes com fetch e reporta a mediana
// do tempo até o primeiro byte (TTFB), o tempo total mediano e o total de bytes do HTML + payload RSC.
//
// Uso:
//   BASE_URL=https://preview.exemplo.vercel.app SESSION_COOKIE='sb-xxx-auth-token=...' node perf/intake-load.mjs [N]
//
// Variáveis:
//   BASE_URL        origem do ambiente medido (sem barra final).
//   SESSION_COOKIE  valor do header Cookie de uma sessão logada (recepção, supervisor ou gestor).
//   RUNS            opcional, número de cargas (padrão 10; o argumento N tem prioridade).
//   PATH_UNDER_TEST opcional, caminho medido (padrão /recepcao/a-autorizar).
//
// Não grava segredo em arquivo e não imprime o cookie. Sai com código 1 se faltar variável ou se a tela
// não responder 200 com a sessão informada.

const BASE_URL = process.env.BASE_URL?.replace(/\/+$/, "");
const COOKIE = process.env.SESSION_COOKIE;
const runs = Math.max(1, Number.parseInt(process.argv[2] ?? process.env.RUNS ?? "10", 10) || 10);
const path = process.env.PATH_UNDER_TEST ?? "/recepcao/a-autorizar";

const missing = [];
if (!BASE_URL) missing.push("BASE_URL");
if (!COOKIE) missing.push("SESSION_COOKIE");
if (missing.length > 0) {
  console.error(`Erro: faltam variáveis de ambiente: ${missing.join(", ")}.`);
  console.error("Exemplo: BASE_URL=https://preview.exemplo.app SESSION_COOKIE='nome=valor' node perf/intake-load.mjs 10");
  process.exit(1);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Uma carga: tempo até o primeiro byte do corpo, tempo total e bytes do corpo (sem descompressão extra). */
async function loadOnce(headers) {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, { headers, redirect: "manual", cache: "no-store" });
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status} em ${path} (redirecionou para ${res.headers.get("location") ?? "?"}); confira SESSION_COOKIE.`);
  }
  const reader = res.body.getReader();
  let ttfb = null;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (ttfb === null) ttfb = performance.now() - t0;
    if (done) break;
    bytes += value.byteLength;
  }
  return { ttfb: ttfb ?? performance.now() - t0, total: performance.now() - t0, bytes };
}

async function measure(label, headers) {
  await loadOnce(headers); // aquecimento (cold start e cache do servidor), não entra na conta
  const samples = [];
  for (let i = 0; i < runs; i++) samples.push(await loadOnce(headers));
  return {
    label,
    runs,
    ttfbMs: Math.round(median(samples.map((s) => s.ttfb))),
    totalMs: Math.round(median(samples.map((s) => s.total))),
    bytes: Math.round(median(samples.map((s) => s.bytes))),
  };
}

try {
  const base = { cookie: COOKIE, "user-agent": "intake-load-perf" };
  const html = await measure("HTML (navegação completa)", { ...base, accept: "text/html" });
  // Payload RSC: o mesmo caminho pedido como navegação do App Router (corpo em formato flight).
  const rsc = await measure("RSC (navegação no app)", { ...base, accept: "text/x-component", RSC: "1" });
  console.log(`Fila de entrada: ${BASE_URL}${path} (${runs} cargas + 1 de aquecimento cada)`);
  for (const r of [html, rsc]) {
    console.log(`- ${r.label}: TTFB mediano ${r.ttfbMs} ms, total mediano ${r.totalMs} ms, ${kb(r.bytes)} (${r.bytes} bytes)`);
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), path, html, rsc }));
} catch (err) {
  console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
