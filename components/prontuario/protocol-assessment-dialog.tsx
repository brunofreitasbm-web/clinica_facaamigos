"use client";

import { useState } from "react";

export interface ProtocolScoreItem {
  code: string;
  domain: string;
  description: string;
  score: 0 | 0.5 | 1;
}

export function ProtocolAssessmentDialog({
  patientName = "Gabriel Santos Silva",
}: {
  patientName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [protocol, setProtocol] = useState<"vbmapp" | "ablls_r" | "esdm">("vbmapp");
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [items, setItems] = useState<ProtocolScoreItem[]>([
    { code: "MAND-1M", domain: "Mandar (Solicitações)", description: "Solicita 2 itens desejados com dica gestual/verbal", score: 1 },
    { code: "MAND-2M", domain: "Mandar (Solicitações)", description: "Solicita 5 itens desejados sem dica (independente)", score: 0.5 },
    { code: "TATO-1M", domain: "Tato (Nomeação)", description: "Nomeia 2 objetos familiares quando perguntado 'O que é isso?'", score: 1 },
    { code: "ECO-1M", domain: "Ecoico (Repetição)", description: "Duplica 2 sons vocais produzidos pelo avaliador", score: 1 },
    { code: "SOC-1M", domain: "Comportamento Social", description: "Faz contato visual com pares por 3 segundos", score: 0 },
  ]);

  const handleScoreChange = (code: string, newScore: 0 | 0.5 | 1) => {
    setItems((prev) =>
      prev.map((it) => (it.code === code ? { ...it, score: newScore } : it))
    );
  };

  const totalScore = items.reduce((acc, cur) => acc + cur.score, 0);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent/5 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors"
      >
        📋 Registrar Avaliação de Protocolo (VB-MAPP / Denver)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-paper shadow-2xl overflow-hidden border border-paper-line">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-paper-line px-6 py-4 bg-paper-subtle">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Avaliação de Protocolo Clínico Licenciado
                </h3>
                <p className="text-xs text-ink-soft">
                  Paciente: <span className="font-semibold text-ink">{patientName}</span> · RLS Restrito a Supervisores e Terapeutas Certificados
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-ink-soft hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Seleção de Instrumento e Nível */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                    Instrumento Comercial
                  </label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <option value="vbmapp">VB-MAPP (Avaliação de Marcos)</option>
                    <option value="ablls_r">ABLLS-R (Currículo ABA)</option>
                    <option value="esdm">Denver / ESDM (Intervenção Precoce)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                    Nível do Marco
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value) as any)}
                    className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <option value={1}>Nível 1 (0 a 18 meses)</option>
                    <option value={2}>Nível 2 (18 a 30 meses)</option>
                    <option value={3}>Nível 3 (30 a 48 meses)</option>
                  </select>
                </div>
              </div>

              {/* Aviso RLS e Salvaguardas §9.4-A */}
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">Salvaguarda RLS (§9.4-A):</span> Este conteúdo é estritamente de uso interno para acompanhamento clínico. Nunca é exposto ao portal da família ou exportado em PDF.
              </div>

              {/* Tabela de Itens de Avaliação */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">
                    Itens do Teste / Marcos
                  </h4>
                  <span className="text-xs font-bold text-accent">
                    Pontuação Total: {totalScore} de {items.length} pts
                  </span>
                </div>

                <div className="divide-y divide-paper-line rounded-lg border border-paper-line bg-paper">
                  {items.map((it) => (
                    <div key={it.code} className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-accent mr-2">{it.code}</span>
                        <span className="font-semibold text-ink">{it.domain}:</span>
                        <p className="text-ink-soft mt-0.5">{it.description}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleScoreChange(it.code, 0)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            it.score === 0
                              ? "bg-red-600 text-white font-bold"
                              : "bg-paper-subtle text-ink-soft border border-paper-line"
                          }`}
                        >
                          0 (Não faz)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScoreChange(it.code, 0.5)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            it.score === 0.5
                              ? "bg-amber-500 text-white font-bold"
                              : "bg-paper-subtle text-ink-soft border border-paper-line"
                          }`}
                        >
                          0.5 (Parcial)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScoreChange(it.code, 1)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            it.score === 1
                              ? "bg-emerald-600 text-white font-bold"
                              : "bg-paper-subtle text-ink-soft border border-paper-line"
                          }`}
                        >
                          1 (Dominado)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-paper-line px-6 py-4 bg-paper-subtle">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-paper-line-strong px-4 py-2 text-xs font-medium text-ink hover:bg-paper-line"
              >
                Cancelar
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
              >
                ✓ Salvar Pontuação no Prontuário
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
