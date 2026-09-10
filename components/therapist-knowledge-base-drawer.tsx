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
  Activity,
  PenTool,
  Lock,
  UserCheck,
  TrendingUp,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { THERAPIST_KB_DATA, TherapistKBArticle } from "@/lib/therapist-knowledge-base-data";
import Link from "next/link";

interface TherapistKnowledgeBaseDrawerProps {
  initialOpen?: boolean;
}

export function TherapistKnowledgeBaseDrawer({ initialOpen = false }: TherapistKnowledgeBaseDrawerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  // Filtro de artigos
  const filteredArticles = useMemo(() => {
    return THERAPIST_KB_DATA.filter((article) => {
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
    return THERAPIST_KB_DATA.find((a) => a.id === activeArticleId) || null;
  }, [activeArticleId]);

  const categories = [
    { id: "all", label: "Todos os Fluxos", icon: BookOpen },
    { id: "agenda", label: "Agenda & Início", icon: Calendar },
    { id: "coleta", label: "Coleta ABA", icon: Activity },
    { id: "evolucao", label: "Evolução (≤2 min)", icon: PenTool },
    { id: "assinatura", label: "PIN & Append-Only", icon: Lock },
    { id: "prontuario", label: "Consulta ao PEI", icon: UserCheck },
    { id: "metricas", label: "Repasse & Métricas", icon: TrendingUp },
  ];

  return (
    <>
      {/* Botão Flutuante de Ajuda na Tela do Terapeuta (Mobile & Desktop) */}
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 sm:bottom-6 sm:right-6">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:from-emerald-500 hover:to-teal-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-300 sm:px-4 sm:py-3"
          title="Abrir Base de Conhecimento do Terapeuta"
          id="btn-therapist-kb-floating"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
          </span>
          <HelpCircle className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-xs sm:text-sm tracking-wide">Manual do Terapeuta</span>
          <span className="hidden md:inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white uppercase">
            Clínico
          </span>
        </button>
      </div>

      {/* Overlay & Drawer / Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
            <div className="w-screen max-w-3xl bg-slate-50 text-slate-900 shadow-2xl flex flex-col h-full border-l border-slate-200">
              
              {/* Header do Drawer */}
              <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-teal-900/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/20 border border-teal-500/30 text-teal-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">Base de Conhecimento do Terapeuta</h2>
                      <span className="rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] sm:text-xs px-2 py-0.5 font-medium">
                        Módulo Clínico
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Guia prático para evolução em 2 min, coleta ABA em tempo real e regras de prontuário
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Seletor de visualização (Lista x Board Didático) */}
                  <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                        viewMode === "list"
                          ? "bg-teal-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Visão de Artigos"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Artigos</span>
                    </button>
                    <button
                      onClick={() => setViewMode("board")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                        viewMode === "board"
                          ? "bg-teal-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Visão de Board Didático"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Board Didático</span>
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
              <div className="bg-white px-4 sm:px-6 py-4 border-b border-slate-200 shadow-xs space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por prática clínica (ex: evoluir, coleta ABA, PIN, PEI, repasse, atraso)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
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
                            ? "bg-teal-600 text-white shadow-xs"
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                
                {/* Se um artigo específico foi selecionado para detalhe */}
                {activeArticle ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button
                      onClick={() => setActiveArticleId(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ← Voltar para lista de fluxos
                    </button>

                    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <span className="inline-block text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md mb-2">
                            {activeArticle.categoryLabel}
                          </span>
                          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                            {activeArticle.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 mt-1">
                            {activeArticle.summary}
                          </p>
                        </div>
                      </div>

                      {/* Objetivo do Processo */}
                      <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-amber-800 uppercase tracking-wider">
                          <CheckCircle2 className="h-4 w-4 text-amber-600" />
                          Objetivo Prático Clínico
                        </span>
                        <p className="leading-relaxed font-medium">{activeArticle.purpose}</p>
                      </div>

                      {/* Fluxo de Passos BPMN */}
                      <div className="space-y-3">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-teal-600" />
                          Passo a Passo da Sessão (BPMN)
                        </h4>
                        <div className="space-y-3">
                          {activeArticle.bpmn_flow.map((step) => (
                            <div
                              key={step.step}
                              className="flex items-start gap-3 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white font-bold text-xs shadow-xs">
                                {step.step}
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{step.action}</span>
                                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                    Raia: {step.actor}
                                  </span>
                                </div>
                                <p className="text-emerald-700 font-medium flex items-center gap-1 mt-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>Validação de Segurança:</strong> {step.validation}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Diretrizes & Boas Práticas */}
                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="h-4.5 w-4.5 text-teal-600" />
                          Diretrizes & Boas Práticas (O que NUNCA fazer)
                        </h4>
                        <ul className="space-y-1.5 text-xs text-teal-950 font-medium">
                          {activeArticle.anti_error_rules.map((rule, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-teal-600 font-bold shrink-0">✖</span>
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
                            href={btn.target_route || "/terapeuta"}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 transition-colors shadow-xs"
                          >
                            <span>{btn.label}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : viewMode === "list" ? (
                  /* Modo Lista */
                  <div className="space-y-4">
                    {filteredArticles.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-800">Nenhum fluxo encontrado</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Não encontramos nada para "{searchQuery}". Tente pesquisar termos como "evoluir", "coleta ABA", "PIN", "regras" ou "repasse".
                        </p>
                      </div>
                    ) : (
                      filteredArticles.map((article) => (
                        <div
                          key={article.id}
                          onClick={() => setActiveArticleId(article.id)}
                          className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span className="inline-block text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md uppercase">
                                {article.categoryLabel}
                              </span>
                              <h4 className="text-base font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                                {article.title}
                              </h4>
                            </div>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-teal-600 group-hover:text-white transition-all text-slate-500 shrink-0">
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
                            <span className="text-teal-600 font-bold flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              {article.anti_error_rules.length} Diretrizes
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Modo Board Didático */
                  <div className="space-y-6">
                    <div className="bg-teal-950 text-white rounded-2xl p-5 border border-teal-900 shadow-sm space-y-2">
                      <h4 className="text-sm font-bold text-teal-200 uppercase tracking-wider flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-teal-400" />
                        Board Didático Operacional do Terapeuta
                      </h4>
                      <p className="text-xs text-teal-100 leading-relaxed font-medium">
                        Este mapa interativo resume todos os 6 pilares de trabalho dos terapeutas da clínica. Clique em qualquer cartão para ver o passo a passo detalhado ou acessar a tela correspondente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {THERAPIST_KB_DATA.map((article) => (
                        <div
                          key={article.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-teal-400 hover:shadow-md transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-teal-700 uppercase bg-teal-50 px-2 py-0.5 rounded-md">
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

                            {/* Destaque de Diretriz Rápida */}
                            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100 space-y-1">
                              <span className="text-[10px] font-bold text-teal-800 uppercase flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3 text-teal-600" /> Recomendação:
                              </span>
                              <p className="text-[11px] text-teal-950 font-medium line-clamp-2">
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
                                href={article.quick_buttons[0].target_route || "/terapeuta"}
                                onClick={() => setIsOpen(false)}
                                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 transition-colors flex items-center justify-center"
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
                <span className="font-semibold text-slate-600">Clínica FaçaAmigos · Portal do Terapeuta</span>
                <span>Base de Conhecimento v1.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
