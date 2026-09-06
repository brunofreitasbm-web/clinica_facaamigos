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
  const [multaAtrasoPct, setMultaAtrasoPct] = useState(2.0);
  const [jurosMesPct, setJurosMesPct] = useState(1.0);
  const [chavePix, setChavePix] = useState("financeiro@clinicafacaamigos.com.br");
  const [emissaoReciboAuto, setEmissaoReciboAuto] = useState(true);

  const [glosas, setGlosas] = useState<GlosaCategory[]>(DEFAULT_GLOSA_CATEGORIES);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAttr, setNewAttr] = useState<"terapeuta" | "recepcao" | "faturamento" | "operadora">("terapeuta");

  const handleAddGlosa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newDesc) return;
    setGlosas((prev) => [
      ...prev,
      {
        id: `g-${Date.now()}`,
        code: newCode,
        description: newDesc,
        attributableTo: newAttr,
      },
    ]);
    setNewCode("");
    setNewDesc("");
  };

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
          description="Regras de fechamento de competência, parcelamento, juros/multa, PIX e atribuição de glosas."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 p-6 sm:p-10 max-w-4xl">
          {saved && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Regras financeiras salvas com sucesso!
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

          {/* Recebimento Particular e Inadimplência */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Cobrança Particular & Recebimento PIX</h3>
            <p className="text-xs text-ink-faint">Configurações para emissão de recibos, taxas e juros de mora para pacientes particulares.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Chave PIX Oficial da Clínica</label>
                <input
                  type="text"
                  className="input"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                />
                <span className="text-[11px] text-ink-faint">Exibida nos comprovantes e faturas de cobrança particular.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-strong">Multa por Atraso (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={multaAtrasoPct}
                    onChange={(e) => setMultaAtrasoPct(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-strong">Juros / Mês (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    value={jurosMesPct}
                    onChange={(e) => setJurosMesPct(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-paper-line">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                    checked={emissaoReciboAuto}
                    onChange={(e) => setEmissaoReciboAuto(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-ink-strong">
                    Gerar recibo automático após a confirmação de recebimento no sistema
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

            <div className="flex flex-wrap gap-2 items-end pt-2">
              <input
                type="text"
                placeholder="Código (Ex: G-505)"
                className="input text-xs w-32"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
              <input
                type="text"
                placeholder="Descrição do motivo de glosa"
                className="input text-xs flex-1"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <select
                className="input text-xs cursor-pointer w-36"
                value={newAttr}
                onChange={(e) => setNewAttr(e.target.value as any)}
              >
                <option value="terapeuta">Terapeuta</option>
                <option value="recepcao">Recepção</option>
                <option value="faturamento">Faturamento</option>
                <option value="operadora">Operadora</option>
              </select>
              <button type="button" onClick={handleAddGlosa} className="button button-outline text-xs">
                + Adicionar Glosa
              </button>
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
