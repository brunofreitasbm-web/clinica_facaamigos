"use client";

import React, { useState, useTransition } from "react";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { DISCIPLINES } from "@/app/supervisao/planos/novo/disciplines";
import type { PtsTemplate } from "@/lib/pts-templates";
import {
  upsertPtsTemplateAction,
  togglePtsTemplateActiveAction,
} from "@/app/supervisao/pts-template-actions";
import { PageContainer } from "@/components/page-container";

export function PtsTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: PtsTemplate[];
}) {
  const [templates, setTemplates] = useState<PtsTemplate[]>(initialTemplates);
  const [filterDiscipline, setFilterDiscipline] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<PtsTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredTemplates = templates.filter((t) => {
    if (filterDiscipline && t.discipline !== filterDiscipline) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        t.title.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.strategy && t.strategy.toLowerCase().includes(q))
      );
    }
    return true;
  });

  async function handleToggleActive(template: PtsTemplate) {
    const newStatus = !template.active;
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, active: newStatus } : t))
    );
    const result = await togglePtsTemplateActiveAction(template.id, newStatus);
    if (!result.success) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, active: template.active } : t))
      );
      setError(result.error);
    }
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await upsertPtsTemplateAction(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setIsCreating(false);
      setEditingTemplate(null);
      // Recarrega a página para pegar a lista atualizada
      window.location.reload();
    });
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <CadastrosSidebar active="pts-templates" />

      <PageContainer>
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-paper-line pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2 m-0">
              <span>💡</span> Templates do PTS
            </h1>
            <p className="text-xs text-ink-soft mt-1 m-0">
              Gerencie o banco de metas, domínios, linhas de base e estratégias pré-cadastradas para o PTS da clínica.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null);
              setIsCreating(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-chart hover:opacity-90 rounded-md shadow-sm transition-all"
          >
            <span>+</span> Novo Template
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-status-negative-bg border border-status-negative-text/30 text-status-negative-text text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-paper-line-strong shadow-sm">
          <div>
            <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
              Filtrar por Disciplina
            </label>
            <select
              value={filterDiscipline}
              onChange={(e) => setFilterDiscipline(e.target.value)}
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
            <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
              Buscar palavra-chave
            </label>
            <input
              type="text"
              placeholder="Buscar por título, domínio ou meta…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-chart focus:outline-none"
            />
          </div>
        </div>

        {/* Tabela de Templates */}
        <div className="rounded-lg border border-paper-line-strong bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper/80 border-b border-paper-line text-ink-soft uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Disciplina / Domínio</th>
                <th className="px-4 py-3">Título & Meta</th>
                <th className="px-4 py-3">Linha de Base & Estratégia</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-faint">
                    Nenhum template cadastrado. Clique em "+ Novo Template" para adicionar.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((template) => {
                  const discLabel =
                    DISCIPLINES.find((d) => d.value === template.discipline)?.label || template.discipline;
                  return (
                    <tr key={template.id} className="hover:bg-paper/40 transition-all">
                      <td className="px-4 py-3 align-top space-y-1">
                        <span className="inline-block rounded-full bg-chart-soft/60 px-2 py-0.5 text-[10px] font-bold text-chart uppercase">
                          {discLabel}
                        </span>
                        <div className="font-bold text-ink">{template.domain}</div>
                      </td>

                      <td className="px-4 py-3 align-top max-w-xs space-y-1">
                        <div className="font-bold text-ink-strong">{template.title}</div>
                        <p className="text-ink-soft line-clamp-2 m-0">{template.description}</p>
                      </td>

                      <td className="px-4 py-3 align-top max-w-xs space-y-1">
                        {template.baseline && (
                          <div className="text-ink-faint italic line-clamp-1">
                            LB: {template.baseline}
                          </div>
                        )}
                        {template.strategy && (
                          <div className="text-ink line-clamp-2">
                            Est: {template.strategy}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(template)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            template.active
                              ? "bg-status-positive-bg text-status-positive-text hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {template.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingTemplate(template);
                          }}
                          className="text-chart font-semibold hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
        {(isCreating || editingTemplate) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <form
              onSubmit={handleSave}
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-paper-line-strong bg-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-paper-line px-6 py-4 bg-paper/50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink m-0">
                  {editingTemplate ? "Editar Template do PTS" : "Novo Template do PTS"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTemplate(null);
                  }}
                  className="text-ink-faint hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {editingTemplate && <input type="hidden" name="id" value={editingTemplate.id} />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Disciplina *
                    </label>
                    <select
                      name="discipline"
                      defaultValue={editingTemplate?.discipline || "aba"}
                      required
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Domínio *
                    </label>
                    <input
                      name="domain"
                      defaultValue={editingTemplate?.domain || ""}
                      required
                      placeholder="Ex: Comunicação Verbal, Autonomia…"
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                    Título curto do Template *
                  </label>
                  <input
                    name="title"
                    defaultValue={editingTemplate?.title || ""}
                    required
                    placeholder="Ex: Mando com frase de 2 palavras"
                    className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                    Meta SMART (Descrição completa) *
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingTemplate?.description || ""}
                    required
                    rows={3}
                    placeholder="Descreva a meta completa com objetivo mensurável…"
                    className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Linha de Base Padrão
                    </label>
                    <input
                      name="baseline"
                      defaultValue={editingTemplate?.baseline || ""}
                      placeholder="Situação atual de partida…"
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Critério de Mastery
                    </label>
                    <input
                      name="criterion"
                      defaultValue={editingTemplate?.criterion || ""}
                      placeholder="Ex: 80% em 3 sessões consecutivas"
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Horizonte
                    </label>
                    <select
                      name="horizon"
                      defaultValue={editingTemplate?.horizon || "curto"}
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    >
                      <option value="curto">Curto prazo</option>
                      <option value="medio">Médio prazo</option>
                      <option value="longo">Longo prazo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                      Metodologia
                    </label>
                    <select
                      name="methodology"
                      defaultValue={editingTemplate?.methodology || "dtt"}
                      className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                    >
                      <option value="dtt">DTT (ensino estruturado)</option>
                      <option value="naturalistico">Ensino naturalístico</option>
                      <option value="misto">Misto</option>
                      <option value="outra">Outra</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-ink-soft mb-1">
                    Estratégia Recomendada
                  </label>
                  <textarea
                    name="strategy"
                    defaultValue={editingTemplate?.strategy || ""}
                    rows={2}
                    placeholder="Procedimentos e técnicas a serem aplicadas…"
                    className="w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs text-ink focus:border-chart"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-paper-line px-6 py-4 bg-paper/30">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-ink-soft bg-white hover:bg-paper rounded-md border border-paper-line transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2 text-xs font-bold text-white bg-chart hover:opacity-90 rounded-md shadow-md transition-all disabled:opacity-50"
                >
                  {isPending ? "Salvando…" : "Salvar Template"}
                </button>
              </div>
            </form>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
