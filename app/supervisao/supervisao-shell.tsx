"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ShieldCheck, UserX, ListOrdered, Users, CalendarClock } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";
import { PageContainer } from "@/components/page-container";

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

  const count: Partial<Record<SupervisaoTabKey, number>> = {
    agenda1a: nAgenda1a,
    acolhimentos: nAcolhimentos,
    fluxos: nFluxos,
    planos: nPlanos,
    inbox: nInbox,
  };

  // A Coordenação é uma única rota (app/supervisao/page.tsx) com seções
  // trocadas em memória — por isso os primeiros itens são abas (`onSelect`,
  // sem `href`) e não links. "Pacientes", "Lista de Espera", "Prontuário
  // Unificado", "Disponibilidade" e "Aviso Falta Terapeuta" são as exceções:
  // rotas de verdade, fora deste componente. O <ModuleHeader> compartilhado
  // (ver components/module-header.tsx) aceita os dois tipos no mesmo `items`.
  const items: ModuleNavItem[] = [
    ...TABS.map((t) => ({
      key: t.key,
      label: t.label,
      selected: tab === t.key,
      onSelect: () => setTab(t.key),
      badge: count[t.key] ?? 0,
    })),
    { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", match: ["/recepcao/pacientes"], icon: Users },
    { key: "lista-espera", label: "Lista de Espera", href: "/supervisao/lista-espera", icon: ListOrdered },
    { key: "prontuario-unificado", label: "Prontuário Unificado", href: "/supervisao/prontuario-unificado", icon: ShieldCheck },
    { key: "disponibilidade", label: "Disponibilidade", href: "/supervisao/disponibilidade", icon: CalendarClock },
    { key: "emergencias", label: "Aviso Falta Terapeuta", href: "/recepcao/emergencias", icon: UserX },
  ];

  return (
    <SupervisaoTabContext.Provider value={{ tab, setTab }}>
      <ModuleHeader module="Coordenação" navLabel="Seções da coordenação" items={items} />

      <main className="flex flex-1 flex-col">
        <PageContainer>
          {tab === "grade" ? <div key="tab-grade">{gradeTab}</div> : null}
          {tab === "agenda1a" ? <div key="tab-agenda1a">{agenda1aTab}</div> : null}
          {tab === "acolhimentos" ? <div key="tab-acolhimentos">{acolhimentosTab}</div> : null}
          {tab === "fluxos" ? <div key="tab-fluxos">{fluxosTab}</div> : null}
          {tab === "planos" ? <div key="tab-planos">{planosTab}</div> : null}
          {tab === "inbox" ? <div key="tab-inbox">{inboxTab}</div> : null}
        </PageContainer>
      </main>
    </SupervisaoTabContext.Provider>
  );
}
