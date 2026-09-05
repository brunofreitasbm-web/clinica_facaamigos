"use client";

import { useState } from "react";

export interface ReportPatientData {
  patientName: string;
  birthDate: string;
  cid: string;
  insurerName: string;
  cardNumber: string;
  periodLabel: string;
  totalSessions: number;
  attendedSessions: number;
  goalsCount: number;
  achievedGoalsCount: number;
  supervisorName: string;
  supervisorCouncil: string;
}

const DEFAULT_PATIENT_DATA: ReportPatientData = {
  patientName: "Gabriel Santos Silva",
  birthDate: "14/05/2019 (7 anos)",
  cid: "F84.0 - Transtorno do Espectro Autista",
  insurerName: "Bradesco Saúde Concierge",
  cardNumber: "876.543.210-01",
  periodLabel: "Junho a Agosto de 2026",
  totalSessions: 36,
  attendedSessions: 34,
  goalsCount: 8,
  achievedGoalsCount: 6,
  supervisorName: "Dra. Carolina Mendonça",
  supervisorCouncil: "CRP 06/123456",
};

export function RelatorioReavaliacaoDialog({
  data = DEFAULT_PATIENT_DATA,
}: {
  data?: ReportPatientData;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const attendanceRate = Math.round(
    (data.attendedSessions / (data.totalSessions || 1)) * 100
  );
  const goalProgressRate = Math.round(
    (data.achievedGoalsCount / (data.goalsCount || 1)) * 100
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
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
                  Pré-visualização do Relatório para Convênio
                </h2>
                <p className="text-xs text-ink-soft">
                  Relatório oficial formatado para renovação de autorização.
                </p>
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
                    <h1 className="text-xl font-bold text-accent">
                      CLÍNICA FAÇA AMIGOS
                    </h1>
                    <p className="text-xs text-ink-soft">
                      Gestão Clínica & Intervenção Multidisciplinar em TEA/TDAH
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      CNPJ: 12.345.678/0001-90 · Registro CRM/CRP/Crefito Institucional
                    </p>
                  </div>
                  <div className="text-right text-xs text-ink-soft">
                    <p className="font-semibold text-ink">Unidade Central</p>
                    <p>São Paulo - SP</p>
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
                      <p className="font-semibold text-ink">{data.birthDate}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Diagnóstico (CID-10):</span>
                      <p className="font-semibold text-ink">{data.cid}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Convênio Operadora:</span>
                      <p className="font-semibold text-ink">{data.insurerName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Nº da Carteirinha:</span>
                      <p className="font-semibold text-ink font-mono">{data.cardNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium text-ink-soft">Período de Avaliação:</span>
                      <p className="font-semibold text-ink">{data.periodLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Síntese de Frequência e Assiduidade */}
                <div className="rounded-lg border border-paper-line p-4 space-y-3 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    2. Frequência e Assiduidade no Período
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="rounded bg-paper-subtle p-2">
                      <span className="text-ink-soft">Sessões Autorizadas</span>
                      <p className="text-lg font-bold text-ink">{data.totalSessions}</p>
                    </div>
                    <div className="rounded bg-paper-subtle p-2">
                      <span className="text-ink-soft">Sessões Realizadas</span>
                      <p className="text-lg font-bold text-emerald-600">{data.attendedSessions}</p>
                    </div>
                    <div className="rounded bg-paper-subtle p-2">
                      <span className="text-ink-soft">Taxa de Assiduidade</span>
                      <p className="text-lg font-bold text-accent">{attendanceRate}%</p>
                    </div>
                  </div>
                </div>

                {/* Progresso de Metas Terapêuticas */}
                <div className="rounded-lg border border-paper-line p-4 space-y-3 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    3. Progresso das Metas Terapêuticas (Plano Terapêutico Singular)
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between font-medium">
                      <span>Metas Atingidas / Em evolução:</span>
                      <span className="font-bold text-emerald-600">
                        {data.achievedGoalsCount} de {data.goalsCount} metas atingidas ({goalProgressRate}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-paper-line overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${goalProgressRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse mt-2">
                    <thead>
                      <tr className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft">
                        <th className="p-2">Domínio / Disciplina</th>
                        <th className="p-2">Meta SMART</th>
                        <th className="p-2">Status / Critério</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-line">
                      <tr>
                        <td className="p-2 font-medium">Comunicação Verbal (ABA)</td>
                        <td className="p-2">Solicitar itens desejados por gesto/apontar de forma independente</td>
                        <td className="p-2"><span className="text-emerald-700 font-semibold">✓ Atingida</span></td>
                      </tr>
                      <tr>
                        <td className="p-2 font-medium">Terapia Ocupacional</td>
                        <td className="p-2">Manter autorregulação em ambiente com estímulo sonoro por 30 min</td>
                        <td className="p-2"><span className="text-emerald-700 font-semibold">✓ Atingida</span></td>
                      </tr>
                      <tr>
                        <td className="p-2 font-medium">Fonoaudiologia</td>
                        <td className="p-2">Produção dos fonemas /r/ e /l/ em sílabas simples sem auxílio</td>
                        <td className="p-2"><span className="text-amber-700 font-semibold">⟳ Em Aquisição</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Parecer e Recomendação Médica/Clínica */}
                <div className="rounded-lg border border-paper-line p-4 space-y-2 text-xs">
                  <h3 className="font-semibold text-ink uppercase tracking-wide border-b border-paper-line pb-1">
                    4. Parecer Técnico e Recomendação de Continuidade
                  </h3>
                  <p className="text-ink-soft leading-relaxed">
                    O paciente apresentou evolução clínica significativa nos domínios de Comunicação e Autorregulação Sensorial durante o período avaliado. Para consolidação dos ganhos e alcance das metas em aquisição, **recomenda-se a renovação do plano terapêutico multidisciplinar** pelo período de mais 6 (seis) meses, na carga horária prescrita pelo médico assistente.
                  </p>
                </div>

                {/* Assinatura do Supervisor */}
                <div className="pt-8 text-center space-y-1">
                  <div className="mx-auto w-64 border-b border-ink"></div>
                  <p className="font-bold text-sm text-ink">{data.supervisorName}</p>
                  <p className="text-xs text-ink-soft">Supervisor Clínico Responsável · {data.supervisorCouncil}</p>
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
