"use client";

import { useState } from "react";

export interface PayoutItemRow {
  id: string;
  date: string;
  patientName: string;
  discipline: string;
  hourlyRate: number;
  amount: number;
}

export interface PayoutStatementData {
  therapistName: string;
  councilNumber: string;
  competenceMonth: string; // ex: "08/2026"
  tierName: string; // ex: "Faixa 2 - Sênior"
  hourlyRate: number; // ex: R$ 85,00
  totalSessions: number;
  grossAmount: number;
  adjustments: number;
  netAmount: number;
  status: "pendente" | "aprovado" | "pago";
  items: PayoutItemRow[];
}

const DEFAULT_PAYOUT: PayoutStatementData = {
  therapistName: "Dra. Luciana Garcia",
  councilNumber: "CREFITO-3 98765-F",
  competenceMonth: "Agosto / 2026",
  tierName: "Faixa 2 · Especialista Sênior",
  hourlyRate: 90.0,
  totalSessions: 42,
  grossAmount: 3780.0,
  adjustments: 0.0,
  netAmount: 3780.0,
  status: "aprovado",
  items: [
    { id: "item-1", date: "03/08/2026", patientName: "Gabriel Santos Silva", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
    { id: "item-2", date: "04/08/2026", patientName: "Lucas Oliveira Souza", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
    { id: "item-3", date: "05/08/2026", patientName: "Beatriz Lima Pereira", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
    { id: "item-4", date: "07/08/2026", patientName: "Enzo Ferreira Costa", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
    { id: "item-5", date: "10/08/2026", patientName: "Gabriel Santos Silva", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
    { id: "item-6", date: "11/08/2026", patientName: "Sophia Almeida", discipline: "Terapia Ocupacional", hourlyRate: 90, amount: 90 },
  ],
};

export function PayoutStatementModal({
  data = DEFAULT_PAYOUT,
}: {
  data?: PayoutStatementData;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-paper-line-strong bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-paper-subtle transition-colors"
      >
        📄 Extrato de Repasse PDF
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-paper shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:w-full print:rounded-none">
            {/* Header de Ações (Escondido ao imprimir) */}
            <div className="flex items-center justify-between border-b border-paper-line px-6 py-4 bg-paper-subtle print:hidden">
              <div>
                <h2 className="text-base font-bold text-ink">
                  Extrato Mensal de Repasse (PJ)
                </h2>
                <p className="text-xs text-ink-soft">
                  Competência: {data.competenceMonth} · {data.therapistName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                  🖨 Baixar / Imprimir PDF
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-paper-line-strong px-3 py-2 text-xs font-medium text-ink hover:bg-paper-line"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do Extrato Imprimível */}
            <div className="flex-1 overflow-y-auto p-8 text-ink space-y-6 print:overflow-visible print:p-6 print:space-y-4">
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .print-payout, .print-payout * { visibility: visible; }
                  .print-payout { position: absolute; left: 0; top: 0; width: 100%; }
                }
              `}</style>

              <div className="print-payout space-y-6 print:space-y-4">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b-2 border-accent pb-4">
                  <div>
                    <h1 className="text-lg font-bold text-accent">
                      CLÍNICA FAÇA AMIGOS
                    </h1>
                    <p className="text-xs text-ink-soft">
                      Demonstrativo Mensal de Prestação de Serviços (Repasse PJ)
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-semibold text-ink">Competência:</span>
                    <p className="text-sm font-bold text-accent">{data.competenceMonth}</p>
                  </div>
                </div>

                {/* Dados do Prestador */}
                <div className="rounded-lg border border-paper-line p-4 bg-paper-subtle/40 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-ink-soft">Profissional / Prestador:</span>
                    <p className="font-bold text-sm text-ink">{data.therapistName}</p>
                    <p className="text-ink-faint">{data.councilNumber}</p>
                  </div>
                  <div>
                    <span className="text-ink-soft">Faixa Contratual Vigente:</span>
                    <p className="font-semibold text-ink">{data.tierName}</p>
                    <p className="text-ink-faint">Valor por sessão: R$ {data.hourlyRate.toFixed(2)}</p>
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="rounded-lg border border-paper-line p-3 text-center">
                    <span className="text-ink-soft">Sessões Realizadas</span>
                    <p className="text-xl font-bold text-ink">{data.totalSessions}</p>
                  </div>
                  <div className="rounded-lg border border-paper-line p-3 text-center">
                    <span className="text-ink-soft">Valor Bruto Calculado</span>
                    <p className="text-xl font-bold text-ink">
                      R$ {data.grossAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent bg-accent/5 p-3 text-center">
                    <span className="text-ink-soft font-medium">Valor Líquido a Receber</span>
                    <p className="text-xl font-bold text-accent">
                      R$ {data.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Tabela de Atendimentos */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
                    Discriminação das Sessões do Período
                  </h3>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft">
                        <th className="p-2">Data</th>
                        <th className="p-2">Paciente</th>
                        <th className="p-2">Disciplina</th>
                        <th className="p-2 text-right">Valor Sessão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paper-line">
                      {data.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2 font-mono">{item.date}</td>
                          <td className="p-2 font-medium">{item.patientName}</td>
                          <td className="p-2">{item.discipline}</td>
                          <td className="p-2 text-right font-mono font-semibold">
                            R$ {item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé e Nota de Aprovação */}
                <div className="border-t border-paper-line pt-4 text-xs text-ink-soft flex justify-between items-center">
                  <div>
                    <p>Status: <span className="font-semibold uppercase text-emerald-600">{data.status}</span></p>
                    <p className="text-[11px] text-ink-faint">Aprovado pela coordenação financeira da clínica.</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[11px]">Gerado em {new Date().toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
