import { cache } from "react";

/**
 * Contador de queries por request, ativo só com PERF_INSTRUMENT=1 — no-op em
 * produção. Usado pelo harness de benchmark (perf/) para provar "queries por
 * rota" além de "milissegundos", já que o ganho das Fases 1–2 do plano de
 * performance é sobretudo redução de round-trips duplicados.
 *
 * `cache()` dá escopo de request: layout e page que chamam createClient()
 * dentro do mesmo render compartilham o mesmo contador, que é exatamente o
 * escopo que queremos (ver lib/supabase/server.ts).
 */
export const PERF_INSTRUMENT = process.env.PERF_INSTRUMENT === "1";

export type PerfCounter = {
  n: number;
  byTable: Record<string, number>;
  ms: number;
};

export const perfCounter = cache<() => PerfCounter>(() => ({
  n: 0,
  byTable: {},
  ms: 0,
}));

function classify(url: string): string {
  const rest = url.match(/\/rest\/v1\/([^?/]+)/);
  if (rest) return rest[1];
  const other = url.match(/\/(auth|rpc|storage)\/v1\/([^?/]+)/);
  if (other) return `${other[1]}:${other[2]}`;
  return "other";
}

/**
 * Substitui o `fetch` do cliente Supabase (global.fetch da lib) só para
 * medir. Conta PostgREST, RPC e chamadas de Auth (inclui getUser()) — os 3
 * alvos do achado "zero dedup por request" no plano de performance.
 */
export const countingFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  const isSupabase = url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "\0");
  const t0 = isSupabase ? performance.now() : 0;
  const res = await fetch(input, init);
  if (isSupabase) {
    const c = perfCounter();
    c.n += 1;
    c.ms += performance.now() - t0;
    const table = classify(url);
    c.byTable[table] = (c.byTable[table] ?? 0) + 1;
  }
  return res;
};
