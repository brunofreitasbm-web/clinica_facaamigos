"use client";

import React, { useState, useMemo } from "react";
import { 
  HelpCircle, 
  X, 
  Search, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  LayoutGrid, 
  ListFilter, 
  ShieldAlert,
  Calendar,
  UserCheck,
  Users,
  Clock,
  Activity,
  FileText,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { RECEPTION_KB_DATA, KBArticle } from "@/lib/knowledge-base-data";
import Link from "next/link";

interface KnowledgeBaseDrawerProps {
  initialOpen?: boolean;
}

export function KnowledgeBaseDrawer({ initialOpen = false }: KnowledgeBaseDrawerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  // Filtro de artigos
  const filteredArticles = useMemo(() => {
    return RECEPTION_KB_DATA.filter((article) => {
      const matchCategory = selectedCategory === "all" || article.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCategory;

      const matchTitle = article.title.toLowerCase().includes(q);
      const matchSummary = article.summary.toLowerCase().includes(q);
      const matchCategoryLabel = article.categoryLabel.toLowerCase().includes(q);
      const matchFlow = article.bpmn_flow.some(
        (step) => step.action.toLowerCase().includes(q) || step.actor.toLowerCase().includes(q)
      );
      const matchAntiError = article.anti_error_rules.some((rule) => rule.toLowerCase().includes(q));

      return matchCategory && (matchTitle || matchSummary || matchCategoryLabel || matchFlow || matchAntiError);
    });
  }, [searchQuery, selectedCategory]);

  // Artigo selecionado em detalhe
  const activeArticle = useMemo(() => {
    if (!activeArticleId) return null;
    return RECEPTION_KB_DATA.find((a) => a.id === activeArticleId) || null;
  }, [activeArticleId]);

  const categories = [
    { id: "all", label: "Todos os Fluxos", icon: BookOpen },
    { id: "agenda", label: "Agenda do Dia", icon: Calendar },
    { id: "chegada", label: "Na Chegada", icon: UserCheck },
    { id: "paciente", label: "Módulo Paciente", icon: Users },
    { id: "pendencia", label: "Na Pendência", icon: ShieldAlert },
    { id: "atendimento", label: "No Atendimento", icon: Activity },
    { id: "documentos", label: "Nos Documentos", icon: FileText },
  ];

  return (
    <>
      {/* Botão Flutuante de Ajuda / Base de Conhecimento na Tela */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-105 hover:from-rose-500 hover:to-pink-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-rose-300"
          title="Abrir Base de Conhecimento Anti-Erro da Recepção"
          id="btn-reception-kb-floating"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
          </span>
          <HelpCircle className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-sm tracking-wide">Manual Anti-Erro</span>
          <span className="hidden sm:inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white uppercase">
            Recepção
          </span>
        </button>
      </div>

      {/* Overlay & Drawer / Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-full border-l border-slate-200">
              
              {/* Header do Drawer */}
              <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-rose-900/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-white">Base de Conhecimento Anti-Erro</h2>
                      <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-2.5 py-0.5 font-medium">
                        Módulo Recepção
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Guia didático de processos, fluxos BPMN e regras anti-falha para recepção da clínica
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Seletor de visualização (Lista x Board Didático) */}
                  <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                        viewMode === "list"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Visão de Artigos"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      Artigos
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                        viewMode === "board"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Visão de Board Completo"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Board Didático
                    </button>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    aria-label="Fechar drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Barra de Busca e Categorias */}
              <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-xs space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por fluxo (ex: check-in, falta, paciente sem guia, TCLE, laudo)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full h-5 w-5 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Categorias Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Corpo Principal do Drawer */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Se um artigo específico foi selecionado para detalhe */}
                {activeArticle ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button
                      onClick={() => setActiveArticleId(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ← Voltar para lista de fluxos
                    </button>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <span className="inline-block text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-md mb-2">
                            {activeArticle.categoryLabel}
                          </span>
                          <h3 className="text-xl font-extrabold text-slate-900">
                            {activeArticle.title}
                          </h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {activeArticle.summary}
                          </p>
                        </div>
                      </div>

                      {/* Objetivo do Processo */}
                      <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-amber-800 uppercase tracking-wider">
                          <CheckCircle2 className="h-4 w-4 text-amber-600" />
                          Objetivo Didático
                        </span>
                        <p className="leading-relaxed font-medium">{activeArticle.purpose}</p>
                      </div>

                      {/* Fluxo de Passos BPMN */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Clock className="h-4 w-4 text-rose-600" />
                          Fluxo Sequencial Passo a Passo (BPMN)
                        </h4>
                        <div className="space-y-3">
                          {activeArticle.bpmn_flow.map((step) => (
                            <div
                              key={step.step}
                              className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs shadow-xs">
                                {step.step}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{step.action}</span>
                                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                    Raia: {step.actor}
                                  </span>
                                </div>
                                <p className="text-emerald-700 font-medium flex items-center gap-1 mt-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>Validação Anti-Erro:</strong> {step.validation}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Regras Anti-Erro ("O que NUNCA fazer") */}
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="h-4.5 w-4.5 text-rose-600" />
                          Regras de Ouro Anti-Erro (O que NUNCA fazer)
                        </h4>
                        <ul className="space-y-1.5 text-xs text-rose-800 font-medium">
                          {activeArticle.anti_error_rules.map((rule, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-rose-600 font-bold shrink-0">✖</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Tratamento de Exceções */}
                      {activeArticle.exceptions.length > 0 && (
                        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-2">
                          <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="h-4.5 w-4.5 text-sky-600" />
                            Exceções & "E se acontecer...?"
                          </h4>
                          <div className="space-y-2">
                            {activeArticle.exceptions.map((exc, idx) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-sky-100 text-xs space-y-1 shadow-xs">
                                <p className="font-bold text-sky-950">🚨 {exc.situation}</p>
                                <p className="text-sky-800 font-medium">💡 <strong>Solução Rápida:</strong> {exc.solution}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botões de Ação Direta */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                        {activeArticle.quick_buttons.map((btn, idx) => (
                          <Link
                            key={idx}
                            href={btn.target_route || "/recepcao"}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 transition-colors shadow-xs"
                          >
                            <span>{btn.label}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-rose-400" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : viewMode === "list" ? (
                  /* Modo de Visualização em Lista de Artigos */
                  <div className="space-y-4">
                    {filteredArticles.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-800">Nenhum fluxo encontrado</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Não encontramos nada para "{searchQuery}". Tente pesquisar termos como "check-in", "guia", "falta", "paciente" ou "documentos".
                        </p>
                      </div>
                    ) : (
                      filteredArticles.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => setActiveArticleId(article.id)}
                          className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span className="inline-block text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md uppercase">
                                {article.categoryLabel}
                              </span>
                              <h4 className="text-base font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                                {article.title}
                              </h4>
                            </div>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-rose-600 group-hover:text-white transition-all text-slate-500 shrink-0">
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {article.summary}
                          </p>

                          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {article.bpmn_flow.length} Passos Validados
                            </span>
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {article.anti_error_rules.length} Regras Anti-Erro
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Modo Board Didático Completo para Treinamento */
                  <div className="space-y-6">
                    <div className="bg-rose-950 text-white rounded-2xl p-5 border border-rose-900 shadow-sm space-y-2">
                      <h4 className="text-sm font-bold text-rose-200 uppercase tracking-wider flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-rose-400" />
                        Board Didático de Operação Anti-Erro da Recepção
                      </h4>
                      <p className="text-xs text-rose-100 leading-relaxed font-medium">
                        Este mapa interativo resume todos os 6 pilares de trabalho dos recepcionistas contratados. Clique em qualquer cartão para ver o passo a passo detalhado ou acessar a tela correspondente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {RECEPTION_KB_DATA.map((article) => (
                        <div
                          key={article.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-rose-400 hover:shadow-md transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-rose-700 uppercase bg-rose-50 px-2 py-0.5 rounded-md">
                                {article.categoryLabel}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                ID: {article.id}
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-900 text-sm">
                              {article.title}
                            </h5>
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {article.summary}
                            </p>

                            {/* Destaque Anti-Erro Rápido */}
                            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 space-y-1">
                              <span className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3 text-rose-600" /> Regra de Ouro:
                              </span>
                              <p className="text-[11px] text-rose-950 font-medium line-clamp-2">
                                {article.anti_error_rules[0]}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => setActiveArticleId(article.id)}
                              className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-2 transition-colors flex items-center justify-center gap-1"
                            >
                              Ver Passo a Passo
                            </button>
                            {article.quick_buttons[0] && (
                              <Link
                                href={article.quick_buttons[0].target_route || "/recepcao"}
                                onClick={() => setIsOpen(false)}
                                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 transition-colors flex items-center justify-center"
                                title={article.quick_buttons[0].label}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do Drawer */}
              <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Clínica FaçaAmigos · Módulo Recepção</span>
                <span>Base Anti-Erro v1.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
