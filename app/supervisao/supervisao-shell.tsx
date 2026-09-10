"use client";

import { useEffect, type ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
import { useSupervisaoTab, type SupervisaoTabKey } from "./supervisao-tab-context";

export type { SupervisaoTabKey };
export { useSupervisaoTab };

/**
 * Troca de conteúdo entre as 6 abas de dados de /supervisao. O cabeçalho
 * (antes renderizado aqui dentro) agora vive em app/supervisao/layout.tsx —
 * ver components/supervisao-header.tsx. Este componente só entrega o
 * conteúdo da aba ativa e sincroniza as contagens (badges do cabeçalho) com
 * o contexto compartilhado, porque só a page.tsx raiz tem os dados pra
 * calculá-las.
 */
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
  const { tab, setCounts } = useSupervisaoTab();

  useEffect(() => {
    setCounts({ agenda1a: nAgenda1a, acolhimentos: nAcolhimentos, fluxos: nFluxos, planos: nPlanos, inbox: nInbox });
  }, [nAgenda1a, nAcolhimentos, nFluxos, nPlanos, nInbox, setCounts]);

  return (
    <PageContainer>
      {tab === "grade" ? <div key="tab-grade">{gradeTab}</div> : null}
      {tab === "agenda1a" ? <div key="tab-agenda1a">{agenda1aTab}</div> : null}
      {tab === "acolhimentos" ? <div key="tab-acolhimentos">{acolhimentosTab}</div> : null}
      {tab === "fluxos" ? <div key="tab-fluxos">{fluxosTab}</div> : null}
      {tab === "planos" ? <div key="tab-planos">{planosTab}</div> : null}
      {tab === "inbox" ? <div key="tab-inbox">{inboxTab}</div> : null}
    </PageContainer>
  );
}
