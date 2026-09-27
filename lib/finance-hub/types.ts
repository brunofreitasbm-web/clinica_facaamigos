/**
 * Tipos das tabelas fa_fin_* (migration 20260927140000_fa_finance_hub.sql).
 * Não estão em lib/database.types.ts porque esse arquivo é gerado pelo
 * Supabase CLI (`supabase gen types`) e não foi regerado nesta sessão —
 * regenerar depois de aplicar a migration evita o `as unknown as` usado
 * nos data/actions deste módulo (mesmo débito já assumido em
 * app/api/arquivos/mensagem/[messageId]/route.ts e lib/reception-queue.ts).
 */

export type FinUnitSlug = "playground" | "circuito" | "clinica";

export type FinUnit = {
  id: string;
  slug: FinUnitSlug;
  nome: string;
  fonte: "pos_live" | "clinica_live";
};

export type FinMonthlyEntry = {
  id: string;
  unit_id: string;
  competence_month: string; // date, YYYY-MM-DD (dia 1º)
  custos_diretos_manuais: number;
  despesas_operacionais_manuais: number;
  impostos: number;
  depreciacao: number;
  receitas_financeiras: number;
  despesas_financeiras: number;
  retiradas_socios: number;
  aportes_socios: number;
  ajuste_manual: number;
  ajuste_manual_nota: string | null;
  observacoes: string | null;
  status: "aberto" | "fechado";
  filled_by: string | null;
  filled_at: string | null;
};

export type FinBalanceAccount = {
  id: string;
  codigo: string;
  nome: string;
  grupo: "ativo_circulante" | "ativo_nao_circulante" | "passivo_circulante" | "passivo_nao_circulante" | "patrimonio_liquido";
  ordem: number;
  ativo: boolean;
};

export type FinBalanceEntry = {
  id: string;
  account_id: string;
  unit_id: string;
  competence_month: string;
  valor: number;
};
