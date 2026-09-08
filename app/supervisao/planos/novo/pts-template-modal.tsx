"use client";

import React, { useState, useTransition } from "react";
import { DISCIPLINES } from "./disciplines";
import type { PtsTemplate } from "@/lib/pts-templates";
import { fetchPtsTemplatesAction } from "@/app/supervisao/pts-template-actions";

type PtsTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PtsTemplate) => void;
  initialDiscipline?: string;
};

export function PtsTemplateModal({
  isOpen,
  onClose,
  onSelectTemplate,
  initialDiscipline = "",
}: PtsTemplateModalProps) {
  const [disciplineFilter, setDisciplineFilter] = useState(initialDiscipline);
  const [searchTerm, setSearchTerm] = useState("");
  const [templates, setTemplates] = useState<PtsTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Carrega templates do servidor ao abrir o modal ou mudar disciplina
  React.useEffect(() => {
    if (!isOpen) return;

    startTransition(async () => {
      const data = await fetchPtsTemplatesAction(disciplineFilter || undefined);
      setTemplates(data);
      setIsLoaded(true);
    });
  }, [isOpen, disciplineFilter]);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      t.title.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.strategy && t.strategy.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-paper-line-strong bg-white shadow-2xl overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-paper-line px-6 py-4 bg-paper/50">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2 m-0">
              <span className="text-base">💡</span> Banco de Templates do PTS
            </h3>
            <p className="text-xs text-ink-soft m-0 mt-0.5">
              Selecione um objetivo pré-cadastrado para preencher Domínio, Meta, Linha de Base e Estratégia automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-line hover:text-ink transition-all"
          >
            ✕
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 py-3 bg-white border-b border-paper-line">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-ink-soft mb-1">
              Filtrar por Disciplina
            </label>
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
            >
              <option value="">Todas as disciplinas</option>
              {DISCIPLINES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-ink-soft mb-1">
              Buscar palavra-chave (Domínio, Meta, Estratégia)
            </label>
            <input
              type="text"
              placeholder="Digite para buscar…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-chart focus:outline-none"
            />
          </div>
        </div>

        {/* Lista de Templates */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isPending || !isLoaded ? (
            <div className="py-12 text-center text-xs text-ink-faint">
              Carregando templates do banco…
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl">🔍</span>
              <div className="text-xs font-bold uppercase text-ink-soft">Nenhum template encontrado</div>
              <p className="text-xs text-ink-faint max-w-sm mx-auto">
                Tente ajustar os filtros acima ou crie uma nova meta personalizada direto no formulário.
              </p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const discLabel =
                DISCIPLINES.find((d) => d.value === template.discipline)?.label || template.discipline;
              return (
                <div
                  key={template.id}
                  className="group rounded-lg border border-paper-line-strong bg-white p-4 hover:border-chart hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-paper-line/60 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-chart-soft/50 px-2.5 py-0.5 text-[10px] font-bold text-chart uppercase tracking-wide">
                          {discLabel}
                        </span>
                        <span className="text-xs font-bold text-ink">{template.domain}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-ink-strong mt-1 m-0">{template.title}</h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectTemplate(template);
                        onClose();
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-chart hover:opacity-90 rounded-md shadow-sm transition-all"
                    >
                      <span>✓</span> Usar este Template
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-bold text-ink-soft block uppercase text-[10px]">Meta (Descrição):</span>
                      <p className="text-ink text-xs m-0 font-medium">{template.description}</p>
                    </div>

                    {template.baseline && (
                      <div>
                        <span className="font-bold text-ink-soft block uppercase text-[10px]">Linha de Base Padrão:</span>
                        <p className="text-ink-soft text-xs m-0 italic">{template.baseline}</p>
                      </div>
                    )}

                    {template.strategy && (
                      <div className="md:col-span-2 bg-paper/50 p-2.5 rounded-md border border-paper-line">
                        <span className="font-bold text-ink-soft block uppercase text-[10px] mb-0.5">
                          Estratégia Recomendada:
                        </span>
                        <p className="text-ink text-xs m-0">{template.strategy}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-faint md:col-span-2">
                      {template.criterion && <span>🎯 <strong>Critério:</strong> {template.criterion}</span>}
                      {template.horizon && (
                        <span>
                          ⏳ <strong>Horizonte:</strong> {template.horizon === "curto" ? "Curto Prazo" : template.horizon === "medio" ? "Médio Prazo" : "Longo Prazo"}
                        </span>
                      )}
                      {template.methodology && (
                        <span>
                          🔬 <strong>Metodologia:</strong> {template.methodology.toUpperCase()}
                        </span>
                      )}
                      {template.programs_default.length > 0 && (
                        <span className="text-chart font-semibold">
                          📊 {template.programs_default.length} Programa(s) ABA vinculado(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex justify-end border-t border-paper-line px-6 py-3 bg-paper/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink-soft bg-white hover:bg-paper rounded-md border border-paper-line-strong transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
