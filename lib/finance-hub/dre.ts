import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { listFinUnits, getMonthlyEntries } from "./repo";
import { getPosUnitMonthlyFigures } from "./pos-data";
import { getClinicaMonthlyFigures } from "./clinica-data";
import { DEV_CLINIC_ID } from "@/lib/constants";
import type { FinUnit, FinMonthlyEntry } from "./types";

type Supa = SupabaseClient<Database>;

export type UnitDreRow = {
  unit: FinUnit;
  disponivel: boolean;
  motivoIndisponivel?: string;
  receitaOperacional: number;
  custosDiretos: number;
  resultadoBruto: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
  receitasFinanceiras: number;
  despesasFinanceiras: number;
  depreciacao: number;
  impostos: number;
  resultadoLiquido: number;
  /** Entrada de caixa operacional do mês (regime de caixa) — usado no Fluxo de Caixa. */
  entradaCaixaOperacional: number;
  saidaCaixaOperacional: number;
  retiradasSocios: number;
  aportesSocios: number;
  ajusteManual: number;
  ajusteManualNota: string | null;
  lancamentoManual: FinMonthlyEntry | null;
};

const emptyEntry = (unitId: string, competenceMonth: string): FinMonthlyEntry => ({
  id: "",
  unit_id: unitId,
  competence_month: `${competenceMonth}-01`,
  custos_diretos_manuais: 0,
  despesas_operacionais_manuais: 0,
  impostos: 0,
  depreciacao: 0,
  receitas_financeiras: 0,
  despesas_financeiras: 0,
  retiradas_socios: 0,
  aportes_socios: 0,
  ajuste_manual: 0,
  ajuste_manual_nota: null,
  observacoes: null,
  status: "aberto",
  filled_by: null,
  filled_at: null,
});

/**
 * Consolida DRE + insumos de Fluxo de Caixa das 3 unidades num único
 * fetch. `supabase` precisa ser o cliente autenticado (lib/supabase/server)
 * do usuário — é ele quem lê fa_fin_* (RLS) e as tabelas da clínica.
 */
export async function getConsolidatedFinancials(supabase: Supa, competenceMonth: string): Promise<UnitDreRow[]> {
  const units = await listFinUnits(supabase);
  const manualEntries = await getMonthlyEntries(supabase, competenceMonth);
  const manualByUnit = new Map(manualEntries.map((e) => [e.unit_id, e]));

  const rows = await Promise.all(
    units.map(async (unit): Promise<UnitDreRow> => {
      const manual = manualByUnit.get(unit.id) ?? emptyEntry(unit.id, competenceMonth);

      if (unit.fonte === "pos_live") {
        const figures = await getPosUnitMonthlyFigures(unit.slug as "playground" | "circuito", competenceMonth);
        if (!figures.disponivel) {
          return {
            unit,
            disponivel: false,
            motivoIndisponivel: figures.motivo,
            receitaOperacional: 0,
            custosDiretos: 0,
            resultadoBruto: 0,
            despesasOperacionais: 0,
            resultadoOperacional: 0,
            receitasFinanceiras: 0,
            despesasFinanceiras: 0,
            depreciacao: 0,
            impostos: 0,
            resultadoLiquido: 0,
            entradaCaixaOperacional: 0,
            saidaCaixaOperacional: 0,
            retiradasSocios: 0,
            aportesSocios: 0,
            ajusteManual: 0,
            ajusteManualNota: null,
            lancamentoManual: manual,
          };
        }
        return buildRow(unit, manual, {
          receitaOperacional: figures.receitaBruta,
          custosDiretos: manual.custos_diretos_manuais,
          despesasOperacionais: manual.despesas_operacionais_manuais,
          entradaCaixaOperacional: figures.entradaCaixa,
          saidaCaixaOperacional: manual.custos_diretos_manuais + manual.despesas_operacionais_manuais,
        });
      }

      // clinica
      const clinica = await getClinicaMonthlyFigures(supabase, DEV_CLINIC_ID, competenceMonth);
      const receitaOperacional = clinica.receitaConvenio + clinica.receitaParticular;
      const custosDiretos = clinica.repasseTerapeutas + manual.custos_diretos_manuais;
      const despesasOperacionais = clinica.despesasOperacionais + manual.despesas_operacionais_manuais;
      return buildRow(unit, manual, {
        receitaOperacional,
        custosDiretos,
        despesasOperacionais,
        entradaCaixaOperacional: receitaOperacional,
        saidaCaixaOperacional: custosDiretos + despesasOperacionais,
      });
    })
  );

  return rows;
}

function buildRow(
  unit: FinUnit,
  manual: FinMonthlyEntry,
  base: {
    receitaOperacional: number;
    custosDiretos: number;
    despesasOperacionais: number;
    entradaCaixaOperacional: number;
    saidaCaixaOperacional: number;
  }
): UnitDreRow {
  const resultadoBruto = base.receitaOperacional - base.custosDiretos;
  const resultadoOperacional = resultadoBruto - base.despesasOperacionais;
  const resultadoLiquido =
    resultadoOperacional +
    manual.receitas_financeiras -
    manual.despesas_financeiras -
    manual.depreciacao -
    manual.impostos +
    manual.ajuste_manual;

  return {
    unit,
    disponivel: true,
    receitaOperacional: base.receitaOperacional,
    custosDiretos: base.custosDiretos,
    resultadoBruto,
    despesasOperacionais: base.despesasOperacionais,
    resultadoOperacional,
    receitasFinanceiras: manual.receitas_financeiras,
    despesasFinanceiras: manual.despesas_financeiras,
    depreciacao: manual.depreciacao,
    impostos: manual.impostos,
    resultadoLiquido,
    entradaCaixaOperacional: base.entradaCaixaOperacional + manual.receitas_financeiras,
    saidaCaixaOperacional: base.saidaCaixaOperacional + manual.despesas_financeiras + manual.impostos,
    retiradasSocios: manual.retiradas_socios,
    aportesSocios: manual.aportes_socios,
    ajusteManual: manual.ajuste_manual,
    ajusteManualNota: manual.ajuste_manual_nota,
    lancamentoManual: manual,
  };
}
