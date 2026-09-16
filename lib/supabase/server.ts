import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { PERF_INSTRUMENT, countingFetch } from "@/lib/perf/query-counter";

function buildClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Chamado de um Server Component: sem sessão de escrita de cookie
          // disponível ainda (login funcional é a próxima tarefa) — o
          // middleware de auth é quem vai precisar disso de verdade.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // noop: setAll chamado de um Server Component é esperado falhar
          }
        },
      },
      // Só ativo com PERF_INSTRUMENT=1 (build de benchmark) — mede queries
      // por request para o harness em perf/. Nunca ligado em produção.
      ...(PERF_INSTRUMENT ? { global: { fetch: countingFetch } } : {}),
    },
  );
}

/**
 * Memoizado por request via React cache(). Antes desta mudança cada
 * `await createClient()` (≈1200 call-sites no repo) criava um cliente Supabase
 * novo e relia `cookies()` do zero; num render de /recepcao isso acontecia
 * ~30 vezes. A assinatura não muda — call-sites continuam `await
 * createClient()` sem alteração.
 *
 * cache() é escopado à árvore de render de UM request: não há dedup entre
 * requests diferentes, então isto não muda a semântica de auth/RLS.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return buildClient(cookieStore);
});

/**
 * Variante NÃO cacheada — usar em Server Actions que mutam a sessão
 * (signInWithPassword, signOut, updateUser e afins) e que, na mesma
 * invocação de request, precisam ler dados pós-mutação. O cliente
 * memoizado por createClient() guarda o cookie jar de ANTES da mutação;
 * reusá-lo ali leria um estado de sessão desatualizado.
 */
export async function createUncachedClient() {
  const cookieStore = await cookies();
  return buildClient(cookieStore);
}
