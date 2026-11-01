// lib/particular-plans-pure.ts
// Catálogo GLOBAL de planos particulares (Encontro, Primeiro Passo, Laço...), lido
// das linhas `PART-PLANO-*` de `insurer_price_tables` do convênio "Particular".
// Fonte única do valor do pacote: o bot (lib/welcome-menu.ts), a IA
// (lib/twilio-faq-bot.ts) e o faturamento (app/gestor/contratos) usam o mesmo
// valor, independente da terapia. PURO, sem import com alias `@/`, para rodar em
// `node --test --experimental-strip-types` (tests/particular-plans-pure.test.ts).

export const PLAN_CODE_PREFIX = "PART-PLANO-";
export const ENCONTRO_PLAN_CODE = "PART-PLANO-ENCONTRO";

export type PlanRow = {
  procedure_code: string;
  procedure_name: string;
  price: number | string;
  valid_from: string;
  valid_to: string | null;
  session_frequency_note: string | null;
};

export type CatalogPlan = {
  code: string;
  /** Nome comercial sem o prefixo "Plano " (ex.: "Laço"). */
  name: string;
  sessions: number;
  /** Valor do pacote por mês (global, não varia por terapia). */
  price: number;
};

/** Sessões por mês vêm do início da observação: "8 sessões/mês; terapias combináveis...". */
export function sessionsFromNote(note: string | null | undefined): number {
  return Number(/^(\d+) sess/.exec(note ?? "")?.[1] ?? 0);
}

/** Planos vigentes em `today` (AAAA-MM-DD), do menor para o maior número de sessões. */
export function parsePlanRows(rows: PlanRow[], today: string): CatalogPlan[] {
  return rows
    .filter((r) => r.procedure_code.startsWith(PLAN_CODE_PREFIX))
    .filter((r) => r.valid_from <= today && (!r.valid_to || r.valid_to >= today))
    .map((r) => ({
      code: r.procedure_code,
      name: r.procedure_name.replace(/^Plano /, ""),
      sessions: sessionsFromNote(r.session_frequency_note),
      price: Number(r.price),
    }))
    .filter((p) => p.sessions > 0 && p.price > 0)
    .sort((a, b) => a.sessions - b.sessions);
}

/** Como o contrato é cobrado: a sessão avulsa (Encontro) gera uma cobrança por sessão; os demais, a mensalidade do pacote. */
export function billingModeForPlan(plan: Pick<CatalogPlan, "code">): "avulsa" | "pacote" {
  return plan.code === ENCONTRO_PLAN_CODE ? "avulsa" : "pacote";
}
