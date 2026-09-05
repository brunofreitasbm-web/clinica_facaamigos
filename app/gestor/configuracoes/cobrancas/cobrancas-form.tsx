"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

interface GlosaCategory {
  id: string;
  code: string;
  description: string;
  attributableTo: "terapeuta" | "recepcao" | "faturamento" | "operadora";
}

const DEFAULT_GLOSA_CATEGORIES: GlosaCategory[] = [
  { id: "g-1", code: "G-101", description: "Evolução não assinada em até 48h", attributableTo: "terapeuta" },
  { id: "g-2", code: "G-202", description: "Sessão agendada sem autorização prévia", attributableTo: "recepcao" },
  { id: "g-3", code: "G-303", description: "Erro de digitação de lote TISS ou código TUSS", attributableTo: "faturamento" },
  { id: "g-4", code: "G-404", description: "Negativa indevida de cobertura / Carência alegada", attributableTo: "operadora" },
];

export function CobrancasForm() {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [diaFechamento, setDiaFechamento] = useState(25);
  const [exigirEvolucaoAssinadaRepasse, setExigirEvolucaoAssinadaRepasse] = useState(true);
  const [modeloRepasse, setModeloRepasse] = useState<"faixa_hora" | "porcentagem" | "fixo_sessao">("faixa_hora");
  const [glosas, setGlosas] = useState<GlosaCategory[]>(DEFAULT_GLOSA_CATEGORIES);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    });
  };

  return (
    <>
      <ConfigSidebar active="cobrancas" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Cobranças & Financeiro"
          description="Regras de fechamento de competência, cálculo de repasse para profissionais PJ e atribuição de glosas."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 p-6 sm:p-10 max-w-4xl">
          {saved && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Regras financeiras atualizadas com sucesso!
            </div>
          )}

          {/* Fechamento & Repasse */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Fechamento de Competência & Repasse PJ</h3>
            <p className="text-xs text-ink-faint">Parâmetros para geração mensal do faturamento e extrato de repasse dos terapeutas.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Dia padrão de fechamento da competência</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input"
                  value={diaFechamento}
                  onChange={(e) => setDiaFechamento(Number(e.target.value))}
                />
                <span className="text-[11px] text-ink-faint">Dia do mês em que o lote de faturamento e extratos são consolidados.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Modelo Base de Repasse aos Terapeutas</label>
                <select
                  className="input cursor-pointer"
                  value={modeloRepasse}
                  onChange={(e) => setModeloRepasse(e.target.value as any)}
                >
                  <option value="faixa_hora">Tabela por Faixa de Valor-Hora (Tier do Contrato)</option>
                  <option value="porcentagem">Porcentagem sobre o valor faturado da sessão</option>
                  <option value="fixo_sessao">Valor Fixo Único por Sessão Realizada</option>
                </select>
                <span className="text-[11px] text-ink-faint">Conforme PRD §0: repasse calculado por sessão de acordo com contrato PJ.</span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-paper-line">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                    checked={exigirEvolucaoAssinadaRepasse}
                    onChange={(e) => setExigirEvolucaoAssinadaRepasse(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-ink-strong">
                    Exigir evolução clínica registrada e assinada para liberar inclusão no repasse (Requisito PRD §7)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Atribuição de Glosas */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink-strong">Categorias & Atribuição de Glosas</h3>
                <p className="text-xs text-ink-faint">Mapeamento de motivos de glosa com atribuição direta ao responsável (Recepção, Terapeuta, Faturamento, Operadora).</p>
              </div>
            </div>

            <table className="table mt-2">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição da Glosa</th>
                  <th>Atribuível a</th>
                </tr>
              </thead>
              <tbody>
                {glosas.map((g) => (
                  <tr key={g.id}>
                    <td className="font-mono text-xs font-semibold">{g.code}</td>
                    <td className="text-sm">{g.description}</td>
                    <td>
                      <span className="tag capitalize font-medium text-[11px]">
                        {g.attributableTo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="submit" className="button button-primary px-6" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar Regras Financeiras"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
