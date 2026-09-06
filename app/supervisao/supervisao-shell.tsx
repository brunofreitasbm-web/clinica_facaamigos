"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";

const TABS = [
  { key: "grade", label: "Grade" },
  { key: "triagens", label: "Triagens Anamnese" },
  { key: "fluxos", label: "Fluxos" },
  { key: "planos", label: "Planos" },
  { key: "inbox", label: "Caixa de entrada" },
] as const;

export type SupervisaoTabKey = (typeof TABS)[number]["key"];

const SupervisaoTabContext = createContext<{ tab: SupervisaoTabKey; setTab: (t: SupervisaoTabKey) => void }>({
  tab: "grade",
  setTab: () => {},
});

/** Permite que um painel filho (ex.: atalhos da aba Fluxos) troque a aba ativa sem navegar. */
export function useSupervisaoTab() {
  return useContext(SupervisaoTabContext);
}

export function SupervisaoShell({
  nPlanos,
  nInbox,
  nFluxos,
  nTriagens = 0,
  gradeTab,
  triagensTab,
  fluxosTab,
  planosTab,
  inboxTab,
}: {
  nPlanos: number;
  nInbox: number;
  nFluxos: number;
  nTriagens?: number;
  gradeTab: ReactNode;
  triagensTab?: ReactNode;
  fluxosTab: ReactNode;
  planosTab: ReactNode;
  inboxTab: ReactNode;
}) {
  const [tab, setTab] = useState<SupervisaoTabKey>("grade");

  const badge: Record<SupervisaoTabKey, string> = {
    grade: "Grade",
    triagens: nTriagens > 0 ? `Triagens Anamnese · ${nTriagens}` : "Triagens Anamnese",
    fluxos: nFluxos > 0 ? `Fluxos · ${nFluxos}` : "Fluxos",
    planos: `Planos · ${nPlanos}`,
    inbox: `Caixa de entrada · ${nInbox}`,
  };

  return (
    <SupervisaoTabContext.Provider value={{ tab, setTab }}>
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
            <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
              · Coordenação
            </span>
          </span>
        </span>
        <nav className="flex h-full items-center gap-6 text-[15px] font-semibold">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="h-full border-b-2"
              style={{
                color: tab === t.key ? "var(--color-on-accent)" : "var(--color-on-accent-soft)",
                borderColor: tab === t.key ? "var(--color-on-accent)" : "transparent",
              }}
            >
              {badge[t.key]}
            </button>
          ))}
          <Link
            href="/recepcao/emergencias"
            className="flex h-full items-center gap-1.5 border-b-2 border-transparent"
            style={{ color: "var(--color-on-accent-soft)" }}
          >
            <PhoneCall size={15} />
            Emergências
          </Link>
        </nav>
      </header>

      <main className="px-10 py-9">
        {tab === "grade" && gradeTab}
        {tab === "triagens" && triagensTab}
        {tab === "fluxos" && fluxosTab}
        {tab === "planos" && planosTab}
        {tab === "inbox" && inboxTab}
      </main>
    </SupervisaoTabContext.Provider>
  );
}
