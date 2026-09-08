"use client";

import { useState } from "react";
import { NpsMetricsCards, type ScoreDistribution } from "./nps-metrics-cards";
import { FamilyFeedbackPanel, type FamilyFeedbackRow } from "./family-feedback-panel";
import Link from "next/link";

export function NpsTabbedView({
  avgScore,
  responseCount,
  distribution,
  combinedScore10,
  combinedResponseCount,
  monthlyAvgScore,
  monthlyResponseCount,
  pendingAlertsCount,
  familyFeedback,
}: {
  avgScore: number | null;
  responseCount: number;
  distribution: ScoreDistribution[];
  combinedScore10: number | null;
  combinedResponseCount: number;
  monthlyAvgScore: number | null;
  monthlyResponseCount: number;
  pendingAlertsCount: number;
  familyFeedback: FamilyFeedbackRow[];
}) {
  const [activeTab, setActiveTab] = useState<"externo" | "interno">("externo");

  return (
    <div className="flex flex-col gap-6">
      {/* Abas de Navegação */}
      <div className="flex border-b border-divider gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "externo"}
          onClick={() => setActiveTab("externo")}
          className={`flex items-center gap-2 border-b-[4px] px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "externo"
              ? "border-rose-600 text-rose-800 dark:text-rose-300 bg-rose-50/40 dark:bg-rose-950/20"
              : "border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span>NPS & CSAT Externo</span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 font-medium dark:bg-rose-950 dark:text-rose-300">
            Pacientes & Famílias
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "interno"}
          onClick={() => setActiveTab("interno")}
          className={`flex items-center gap-2 border-b-[4px] px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "interno"
              ? "border-rose-600 text-rose-800 dark:text-rose-300 bg-rose-50/40 dark:bg-rose-950/20"
              : "border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span>NPS Interno</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 font-medium dark:bg-blue-950 dark:text-blue-300">
            Equipe Multidisciplinar
          </span>
        </button>
      </div>

      {/* Conteúdo Aba NPS EXTERNO */}
      {activeTab === "externo" && (
        <div className="flex flex-col gap-8">
          {/* Card Informativo de Critérios de Avaliação Externa */}
          <div className="rounded-xl border border-divider bg-surface p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                Critérios Informativos de Avaliação Externa (Satisfação CSAT · 1 a 5 ★)
              </h3>
              <span className="text-[11px] font-medium text-ink-faint">Painel de Referência (Não Clicável)</span>
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Critérios fixos avaliados continuamente via WhatsApp e Portal pelos pacientes e responsáveis.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border-l-4 border-l-rose-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Atendimento da Recepção</span>
                  <span className="rounded bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Cortesia, agilidade e suporte no atendimento</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-rose-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Evolução Terapêutica & Equipe</span>
                  <span className="rounded bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Progresso clínico e relacionamento com terapeutas</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-rose-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Pontualidade & Agendamento</span>
                  <span className="rounded bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Respeito aos horários e facilidade na marcação</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-rose-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Instalações & Conforto</span>
                  <span className="rounded bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Limpeza, acessibilidade e ambiente</p>
              </div>
            </div>
          </div>

          <NpsMetricsCards
            avgScore={avgScore}
            responseCount={responseCount}
            distribution={distribution}
            combinedScore10={combinedScore10}
            combinedResponseCount={combinedResponseCount}
            monthlyAvgScore={monthlyAvgScore}
            monthlyResponseCount={monthlyResponseCount}
          />

          {pendingAlertsCount > 0 && (
            <Link
              href="/supervisao"
              className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm no-underline"
            >
              <span className="font-semibold text-red-800">
                {pendingAlertsCount} alerta(s) de insatisfação aguardando contato
              </span>
              <span className="text-xs font-medium text-red-700">Triagem e resolução ficam na Supervisão →</span>
            </Link>
          )}

          <FamilyFeedbackPanel items={familyFeedback} />
        </div>
      )}

      {/* Conteúdo Aba NPS INTERNO */}
      {activeTab === "interno" && (
        <div className="flex flex-col gap-8">
          {/* Banner Informativo de disparo automático e anonimato */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/75 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                  Disparo Automático via Chatbot Twilio (WhatsApp)
                </span>
                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                  Público: Funcionários CLT e PJ (Exclui Estagiários)
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  100% Anônimo & Sigiloso
                </span>
              </div>
              <h2 className="text-base font-bold text-blue-950 dark:text-blue-200">
                Pesquisa de Clima & Satisfação Interna (Equipe Multidisciplinar e Terapeutas)
              </h2>
              <p className="text-xs leading-relaxed text-blue-900 dark:text-blue-300">
                Esta avaliação tem <strong>caráter exclusivo de melhoria contínua dos processos e suporte interno</strong>. 
                O disparo é feito de forma automática no <strong>último dia útil de cada mês</strong> via Chatbot do Twilio para o número cadastrado dos colaboradores (contratos CLT e PJ). As respostas são registradas com total garantia de anonimato.
              </p>
            </div>
          </div>

          {/* Card de Critérios de Avaliação Interna */}
          <div className="rounded-xl border border-divider bg-surface p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                Critérios Informativos de Avaliação Interna (Satisfação CSAT · 1 a 5 ★)
              </h3>
              <span className="text-[11px] font-medium text-ink-faint">Painel de Referência (Não Clicável)</span>
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Avaliação do clima de trabalho, ferramentas e suporte fornecido pela gestão.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border-l-4 border-l-blue-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Clima Organizacional</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Ambiente de trabalho, cooperação e bem-estar da equipe</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-blue-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Estrutura & Recursos</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Disponibilidade de materiais, salas e equipamentos</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-blue-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Suporte da Gestão</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Escuta ativa, orientações técnicas e liderança</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-blue-500 border border-divider/60 bg-slate-50 dark:bg-slate-900/40 p-3.5 select-none">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-ink">Processos & Sistemas</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 dark:text-blue-300">CSAT 1-5 ★</span>
                </div>
                <p className="text-xs text-ink-soft">Agilidade dos fluxos internos e uso da plataforma</p>
              </div>
            </div>
          </div>

          {/* Cards demonstrativos do NPS Interno */}
          <div className="flex flex-wrap gap-6">
            <div className="card min-w-[220px]">
              <span className="card-kicker">NPS Interno do Mês (0-10)</span>
              <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
                8.9
              </span>
              <span className="text-xs text-ink-faint">78% de participação da equipe</span>
            </div>

            <div className="card min-w-[180px]">
              <span className="card-kicker">Clima Organizacional</span>
              <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
                4.7 ★
              </span>
              <span className="text-xs text-ink-faint">Média da equipe</span>
            </div>

            <div className="card min-w-[180px]">
              <span className="card-kicker">Suporte da Gestão</span>
              <span className="text-3xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
                4.5 ★
              </span>
              <span className="text-xs text-ink-faint">Média da equipe</span>
            </div>

            <div className="card min-w-[200px] flex-1">
              <span className="card-kicker">Próximo Disparo Agendado</span>
              <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                Último dia útil do mês
              </span>
              <span className="text-xs text-ink-faint">Envio automático anônimo a todos os membros</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
