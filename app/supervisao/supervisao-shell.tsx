"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "grade", label: "Grade" },
  { key: "planos", label: "Planos" },
  { key: "inbox", label: "Caixa de entrada" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Cabeçalho + navegação por abas do painel de supervisão (Coordenador.dc.html).
 * As abas trocam sem navegação de rota — os três painéis já vêm renderizados
 * do server (cada um busca seus próprios dados em page.tsx) e este client
 * component só decide qual mostrar, igual ao padrão de
 * components/prontuario/patient-tabs.tsx.
 */
export function SupervisaoShell({
  nPlanos,
  nInbox,
  gradeTab,
  planosTab,
  inboxTab,
}: {
  nPlanos: number;
  nInbox: number;
  gradeTab: ReactNode;
  planosTab: ReactNode;
  inboxTab: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("grade");

  const badge: Record<TabKey, string> = {
    grade: "Grade",
    planos: `Planos · ${nPlanos}`,
    inbox: `Caixa de entrada · ${nInbox}`,
  };

  return (
    <>
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-8 px-10"
      >
        <span className="mr-auto flex items-center gap-3">
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
            <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
            <path
              d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
              fill="var(--color-accent-2)"
            />
            <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
          </svg>
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            Faça Amigos{" "}
            <span style={{ color: "var(--color-accent-2)" }} className="font-normal italic">
              · Coordenação
            </span>
          </span>
        </span>
        <nav className="flex h-full items-center gap-6 text-[15px]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="h-full border-b-2"
              style={{
                color: tab === t.key ? "var(--color-bg)" : "color-mix(in srgb, var(--color-bg) 70%, transparent)",
                borderColor: tab === t.key ? "var(--color-accent-2)" : "transparent",
              }}
            >
              {badge[t.key]}
            </button>
          ))}
          <span className="opacity-70">Equipe</span>
          <span className="opacity-70">Protocolos</span>
        </nav>
      </header>

      <main className="px-10 py-9">
        {tab === "grade" && gradeTab}
        {tab === "planos" && planosTab}
        {tab === "inbox" && inboxTab}
      </main>
    </>
  );
}
