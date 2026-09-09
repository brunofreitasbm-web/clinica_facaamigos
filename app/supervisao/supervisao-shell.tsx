"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, UserX, ListOrdered, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const TABS = [
  { key: "grade", label: "Grade" },
  { key: "agenda1a", label: "Agenda 1ª Avaliação" },
  { key: "acolhimentos", label: "Planilha de Pacientes" },
  { key: "fluxos", label: "Fluxos" },
  { key: "planos", label: "PTS" },
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
  nAcolhimentos = 0,
  nAgenda1a = 0,
  gradeTab,
  agenda1aTab,
  acolhimentosTab,
  fluxosTab,
  planosTab,
  inboxTab,
}: {
  nPlanos: number;
  nInbox: number;
  nFluxos: number;
  nAcolhimentos?: number;
  nAgenda1a?: number;
  gradeTab: ReactNode;
  agenda1aTab?: ReactNode;
  acolhimentosTab?: ReactNode;
  fluxosTab: ReactNode;
  planosTab: ReactNode;
  inboxTab: ReactNode;
}) {
  const [tab, setTab] = useState<SupervisaoTabKey>("grade");
  const pathname = usePathname();

  const count: Partial<Record<SupervisaoTabKey, number>> = {
    agenda1a: nAgenda1a,
    acolhimentos: nAcolhimentos,
    fluxos: nFluxos,
    planos: nPlanos,
    inbox: nInbox,
  };

  return (
    <SupervisaoTabContext.Provider value={{ tab, setTab }}>
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-8 px-10"
      >
        <span className="mr-auto flex items-center gap-3">
          <Logo variant="simbolo" tone="branco" height={30} decorative />
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            FaçaAmigos{" "}
            <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
              · Coordenação
            </span>
          </span>
        </span>
        <nav role="tablist" aria-label="Seções da coordenação" className="flex h-full items-center gap-6 text-[15px]">
          {TABS.map((t) => {
            const n = count[t.key] ?? 0;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.key)}
                className="flex h-full items-center gap-1.5 transition-all"
                style={{
                  color: isActive ? "#FFFFFF" : "var(--color-on-accent-soft)",
                  borderBottom: isActive ? "3px solid #FFFFFF" : "3px solid transparent",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {t.label}
                {n > 0 && (
                  <span
                    className="inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                    style={{ background: "var(--color-accent-2)", color: "var(--color-bg)" }}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
          <Link
            href="/recepcao/pacientes"
            className="flex h-full items-center gap-1.5 transition-all"
            aria-current={pathname.startsWith("/recepcao/pacientes") ? "page" : undefined}
            style={{
              color: pathname.startsWith("/recepcao/pacientes") ? "#FFFFFF" : "var(--color-on-accent-soft)",
              borderBottom: pathname.startsWith("/recepcao/pacientes") ? "3px solid #FFFFFF" : "3px solid transparent",
              fontWeight: pathname.startsWith("/recepcao/pacientes") ? 700 : 500,
            }}
          >
            <Users size={15} />
            Pacientes
          </Link>
          <Link
            href="/supervisao/lista-espera"
            className="flex h-full items-center gap-1.5 transition-all"
            aria-current={pathname === "/supervisao/lista-espera" ? "page" : undefined}
            style={{
              color: pathname === "/supervisao/lista-espera" ? "#FFFFFF" : "var(--color-on-accent-soft)",
              borderBottom: pathname === "/supervisao/lista-espera" ? "3px solid #FFFFFF" : "3px solid transparent",
              fontWeight: pathname === "/supervisao/lista-espera" ? 700 : 500,
            }}
          >
            <ListOrdered size={15} />
            Lista de Espera
          </Link>
          <Link
            href="/supervisao/prontuario-unificado"
            className="flex h-full items-center gap-1.5 transition-all"
            aria-current={pathname === "/supervisao/prontuario-unificado" ? "page" : undefined}
            style={{
              color: pathname === "/supervisao/prontuario-unificado" ? "#FFFFFF" : "var(--color-on-accent-soft)",
              borderBottom: pathname === "/supervisao/prontuario-unificado" ? "3px solid #FFFFFF" : "3px solid transparent",
              fontWeight: pathname === "/supervisao/prontuario-unificado" ? 700 : 500,
            }}
          >
            <ShieldCheck size={15} />
            Prontuário Unificado
          </Link>
          <Link
            href="/recepcao/emergencias"
            className="flex h-full items-center gap-1.5 transition-all"
            aria-current={pathname === "/recepcao/emergencias" ? "page" : undefined}
            style={{
              color: pathname === "/recepcao/emergencias" ? "#FFFFFF" : "var(--color-on-accent-soft)",
              borderBottom: pathname === "/recepcao/emergencias" ? "3px solid #FFFFFF" : "3px solid transparent",
              fontWeight: pathname === "/recepcao/emergencias" ? 700 : 500,
            }}
          >
            <UserX size={15} />
            Aviso Falta Terapeuta
          </Link>
        </nav>
      </header>

      <main className="px-10 py-9">
        {tab === "grade" ? <div key="tab-grade">{gradeTab}</div> : null}
        {tab === "agenda1a" ? <div key="tab-agenda1a">{agenda1aTab}</div> : null}
        {tab === "acolhimentos" ? <div key="tab-acolhimentos">{acolhimentosTab}</div> : null}
        {tab === "fluxos" ? <div key="tab-fluxos">{fluxosTab}</div> : null}
        {tab === "planos" ? <div key="tab-planos">{planosTab}</div> : null}
        {tab === "inbox" ? <div key="tab-inbox">{inboxTab}</div> : null}
      </main>
    </SupervisaoTabContext.Provider>
  );
}
