import { listFinUnits, listBalanceAccounts, getBalanceEntries, type AnySupabase } from "./repo";
import type { FinUnit, FinBalanceAccount } from "./types";

export type BalancoAccountRow = {
  account: FinBalanceAccount;
  porUnidade: Record<string, number>; // unitId -> valor
  total: number;
};

export type BalancoData = {
  units: FinUnit[];
  linhasPorGrupo: Record<FinBalanceAccount["grupo"], BalancoAccountRow[]>;
  totalPorGrupo: Record<FinBalanceAccount["grupo"], number>;
  totalAtivo: number;
  totalPassivoMaisPl: number;
  diferenca: number; // deveria ser 0 — se não for, o balanço não fecha
};

export async function getBalancoPatrimonial(supabase: AnySupabase, competenceMonth: string): Promise<BalancoData> {
  const [units, accounts, entries] = await Promise.all([
    listFinUnits(supabase),
    listBalanceAccounts(supabase),
    getBalanceEntries(supabase, competenceMonth),
  ]);

  const valorPorConta = new Map<string, Record<string, number>>();
  for (const entry of entries) {
    const byUnit = valorPorConta.get(entry.account_id) ?? {};
    byUnit[entry.unit_id] = entry.valor;
    valorPorConta.set(entry.account_id, byUnit);
  }

  const linhasPorGrupo: BalancoData["linhasPorGrupo"] = {
    ativo_circulante: [],
    ativo_nao_circulante: [],
    passivo_circulante: [],
    passivo_nao_circulante: [],
    patrimonio_liquido: [],
  };
  const totalPorGrupo: BalancoData["totalPorGrupo"] = {
    ativo_circulante: 0,
    ativo_nao_circulante: 0,
    passivo_circulante: 0,
    passivo_nao_circulante: 0,
    patrimonio_liquido: 0,
  };

  for (const account of accounts) {
    const porUnidade = valorPorConta.get(account.id) ?? {};
    const total = units.reduce((sum, u) => sum + (porUnidade[u.id] ?? 0), 0);
    linhasPorGrupo[account.grupo].push({ account, porUnidade, total });
    totalPorGrupo[account.grupo] += total;
  }

  const totalAtivo = totalPorGrupo.ativo_circulante + totalPorGrupo.ativo_nao_circulante;
  const totalPassivoMaisPl =
    totalPorGrupo.passivo_circulante + totalPorGrupo.passivo_nao_circulante + totalPorGrupo.patrimonio_liquido;

  return {
    units,
    linhasPorGrupo,
    totalPorGrupo,
    totalAtivo,
    totalPassivoMaisPl,
    diferenca: totalAtivo - totalPassivoMaisPl,
  };
}
