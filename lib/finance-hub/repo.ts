import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinUnit, FinMonthlyEntry, FinBalanceAccount, FinBalanceEntry } from "./types";

/**
 * Acesso a fa_fin_* sempre com o cliente autenticado do próprio usuário
 * (lib/supabase/server.ts `createClient()`), nunca com o admin — a RLS da
 * migration 20260927140000_fa_finance_hub.sql já restringe a
 * gestor/faturamento, então usar o client do usuário garante que a Server
 * Action falha (RLS) se alguém tentar chamar sem ser um desses papéis.
 *
 * `any` porque database.types.ts ainda não foi regerado com as tabelas
 * novas (ver lib/finance-hub/types.ts) — mesmo débito já assumido em
 * lib/reception-queue.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = SupabaseClient<any>;

function fin(supabase: AnySupabase) {
  return supabase;
}

export async function listFinUnits(supabase: AnySupabase): Promise<FinUnit[]> {
  const { data, error } = await fin(supabase).from("fa_fin_units").select("*").order("slug");
  if (error) throw new Error(`fa_fin_units: ${error.message}`);
  return data ?? [];
}

export async function getMonthlyEntries(
  supabase: AnySupabase,
  competenceMonth: string
): Promise<FinMonthlyEntry[]> {
  const { data, error } = await fin(supabase)
    .from("fa_fin_monthly_entries")
    .select("*")
    .eq("competence_month", `${competenceMonth}-01`);
  if (error) throw new Error(`fa_fin_monthly_entries: ${error.message}`);
  return data ?? [];
}

export async function upsertMonthlyEntry(
  supabase: AnySupabase,
  input: {
    unitId: string;
    competenceMonth: string;
    custosDiretosManuais: number;
    despesasOperacionaisManuais: number;
    impostos: number;
    depreciacao: number;
    receitasFinanceiras: number;
    despesasFinanceiras: number;
    retiradasSocios: number;
    aportesSocios: number;
    ajusteManual: number;
    ajusteManualNota: string | null;
    observacoes: string | null;
    status: "aberto" | "fechado";
    filledBy: string;
  }
) {
  const { error } = await fin(supabase)
    .from("fa_fin_monthly_entries")
    .upsert(
      {
        unit_id: input.unitId,
        competence_month: `${input.competenceMonth}-01`,
        custos_diretos_manuais: input.custosDiretosManuais,
        despesas_operacionais_manuais: input.despesasOperacionaisManuais,
        impostos: input.impostos,
        depreciacao: input.depreciacao,
        receitas_financeiras: input.receitasFinanceiras,
        despesas_financeiras: input.despesasFinanceiras,
        retiradas_socios: input.retiradasSocios,
        aportes_socios: input.aportesSocios,
        ajuste_manual: input.ajusteManual,
        ajuste_manual_nota: input.ajusteManualNota,
        observacoes: input.observacoes,
        status: input.status,
        filled_by: input.filledBy,
        filled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unit_id,competence_month" }
    );
  if (error) throw new Error(`fa_fin_monthly_entries upsert: ${error.message}`);
}

export async function listBalanceAccounts(supabase: AnySupabase): Promise<FinBalanceAccount[]> {
  const { data, error } = await fin(supabase)
    .from("fa_fin_balance_accounts")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  if (error) throw new Error(`fa_fin_balance_accounts: ${error.message}`);
  return data ?? [];
}

export async function getBalanceEntries(
  supabase: AnySupabase,
  competenceMonth: string
): Promise<FinBalanceEntry[]> {
  const { data, error } = await fin(supabase)
    .from("fa_fin_balance_entries")
    .select("*")
    .eq("competence_month", `${competenceMonth}-01`);
  if (error) throw new Error(`fa_fin_balance_entries: ${error.message}`);
  return data ?? [];
}

export async function upsertBalanceEntry(
  supabase: AnySupabase,
  input: { accountId: string; unitId: string; competenceMonth: string; valor: number; updatedBy: string }
) {
  const { error } = await fin(supabase)
    .from("fa_fin_balance_entries")
    .upsert(
      {
        account_id: input.accountId,
        unit_id: input.unitId,
        competence_month: `${input.competenceMonth}-01`,
        valor: input.valor,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,unit_id,competence_month" }
    );
  if (error) throw new Error(`fa_fin_balance_entries upsert: ${error.message}`);
}
