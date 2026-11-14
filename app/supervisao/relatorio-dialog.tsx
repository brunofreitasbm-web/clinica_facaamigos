"use client";

import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { goalStatusLabel } from "@/lib/goal-status-label-pure";

export interface ReportGoalItem {
  domain: string;
  description: string;
  status: string;
}

/**
 * Só entra aqui o que o sistema sabe de verdade sobre este plano. O que ele ainda não
 * traz para este relatório (nascimento, CID, convênio, carteirinha, frequência,
 * supervisor) sai em branco no papel, para preencher à mão: nunca um valor de exemplo.
 */
export interface ReportPatientData {
  patientName: string;
  periodLabel: string;
  goalsList: ReportGoalItem[];
}

const BLANK = "________________________";

export function RelatorioReavaliacaoDialog({ data }: { data: ReportPatientData }) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary inline-flex items-center gap-2 text-xs"
      >
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Gerar Relatório de Reavaliação (PDF)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-paper shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:w-full print:rounded-none">
            {/* Header de Ações no Modal (Escondido ao imprimir) */}
            <div className="flex items-center justify-between border-b border-paper-line px-6 py-4 bg-paper-subtle print:hidden">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Pré-visualização do Relatório para Plano de Saúde
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  🖨 Imprimir / Salvar em PDF
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-paper-line-strong px-3 py-2 text-xs font-medium text-ink hover:bg-paper-line"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do Relatório Imprimível */}
            <div className="flex-1 overflow-y-auto p-8 text-ink space-y-6 print:overflow-visible print:p-6 print:space-y-4">
              {/* Estilos específicos de impressão */}
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .print-document, .print-document * { visibility: visible; }
                  .print-document { position: absolute; left: 0; top: 0; width: 100%; }
                }
              `}</style>

              <div className="print-document space-y-6 print:space-y-4">
                {/* Timbre da Clínica */}
                <div className="flex items-center justify-between border-b-2 border-accent pb-4">
                  <div>
                    <Logo variant="horizontal" height={36} className="print:grayscale mb-2" />
                    <p className="text-xs text-ink-soft">
                      Gestão Clínica & Intervenção Multidisciplinar em TEA/TDAH
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      CNPJ: 12.345.678/0001-90 · Registro CRM/CRP/Crefito Institucional
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-soft">
                    <p className="font-semibold text-ink">Unidade Central</p>
                    <p>Belém - PA</p>
                    <p>Contato: (11) 3000-0000</p>
                  </div>
                </div>

                {/* Título do Relatório */}
                <div className="text-center bg-paper-subtle py-3 rounded-md border border-paper-line">
                  <h2 className="text-base font-bold uppercase tracking-wider text-ink">
                    RELATÓRIO DE EVOLUÇÃO E REAVALIAÇÃO CLÍNICA MULTIDISCIPLINAR
                  </h2>
                  <p className="text-xs text-ink-soft">
                    Para fins de Renovação de Guia de Autorização de Tratamento
                  </p>
                </div>

                <p className="print:hidden rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Nascimento, CID, convênio, carteirinha e parecer saem em branco: o sistema ainda não traz esses dados para este
                  relatório. Preencha à mão depois de imprimir.
                </p>

                {/* Tabela de Dados do Paciente */}
                <div className="rounded-lg border border-paper-line p-4 bg-paper/50 space-y-3 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    1. Identificação do Paciente
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                    <div>
                      <span className="font-medium text-ink-soft">Nome do Paciente:</span>
                      <p className="font-semibold text-ink text-sm">{data.patientName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Data Nasc. / Idade:</span>
                      <p className="font-semibold text-ink">{BLANK}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Diagnóstico (CID-10):</span>
                      <p className="font-semibold text-ink">{BLANK}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Operadora do Plano de Saúde:</span>
                      <p className="font-semibold text-ink">{BLANK}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Nº da Carteirinha:</span>
                      <p className="font-semibold text-ink font-mono">{BLANK}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Período de Avaliação:</span>
                      <p className="font-semibold text-ink">{data.periodLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Progresso de Metas Terapêuticas */}
                <div className="rounded-lg border border-paper-line p-4 space-y-3 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    3. Progresso das Metas Terapêuticas (Plano Terapêutico Singular)
                  </h3>
                  <p className="font-medium">
                    {data.goalsList.length} {data.goalsList.length === 1 ? "meta" : "metas"} no plano
                  </p>

                  <table className="w-full text-left text-xs border-collapse mt-2">
                    <thead>
                      <tr className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft">
                        <th className="p-2">Domínio / Disciplina</th>
                        <th className="p-2">Meta SMART</th>
                        <th className="p-2">Status / Critério</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-line">
                      {data.goalsList.length > 0 ? (
                        data.goalsList.map((g, idx) => {
                          const st = goalStatusLabel(g.status);
                          return (
                            <tr key={idx}>
                              <td className="p-2 font-medium">{g.domain}</td>
                              <td className="p-2">{g.description}</td>
                              <td className="p-2">
                                <span
                                  className={`font-semibold ${st.tone === "ok" ? "text-emerald-700" : st.tone === "back" ? "text-rose-700" : "text-amber-700"}`}
                                >
                                  {st.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="p-2 text-ink-faint" colSpan={3}>
                            Este plano ainda não tem metas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Parecer e Recomendação Médica/Clínica */}
                <div className="rounded-lg border border-paper-line p-4 space-y-2 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    4. Parecer Técnico e Recomendação de Continuidade (a preencher pelo supervisor)
                  </h3>
                  <div className="space-y-5 pt-2" aria-label="Espaço para o parecer do supervisor">
                    <div className="border-b border-paper-line-strong" />
                    <div className="border-b border-paper-line-strong" />
                    <div className="border-b border-paper-line-strong" />
                    <div className="border-b border-paper-line-strong" />
                  </div>
                </div>

                {/* Assinatura do Supervisor */}
                <div className="pt-8 text-center space-y-1">
                  <div className="mx-auto w-64 border-b border-ink"></div>
                  <p className="font-bold text-sm text-ink">{BLANK}</p>
                  <p className="text-xs text-ink-soft">Supervisor Clínico Responsável · Conselho/Nº: {BLANK}</p>
                  <p className="text-[11px] text-ink-faint">Data da emissão: {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
