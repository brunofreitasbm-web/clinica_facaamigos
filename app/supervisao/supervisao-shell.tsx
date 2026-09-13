"use client";

import { useEffect, type ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
import { useSupervisaoTab, type SupervisaoTabKey } from "./supervisao-tab-context";

export type { SupervisaoTabKey };
export { useSupervisaoTab };

/**
 * Troca de conteúdo entre as 5 abas de dados de /supervisao. O cabeçalho
 * (antes renderizado aqui dentro) agora vive em app/supervisao/layout.tsx —
 * ver components/supervisao-header.tsx. Este componente só entrega o
 * conteúdo da aba ativa e sincroniza as contagens (badges do cabeçalho) com
 * o contexto compartilhado, porque só a page.tsx raiz tem os dados pra
 * calculá-las.
 *
 * "Planilha de Pacientes" não tem mais aba própria (13/09/2026) — o badge
 * dela (nAcolhimentos/nAcolhimentosUrgent) é somado ao badge de
 * "Agenda 1ª Avaliação", já que o conteúdo virou sub-aba de lá; ver
 * agenda-avaliacoes-panel.tsx.
 */
export function SupervisaoShell({
  nPlanos,
  nInbox,
  nFluxos,
  nAcolhimentos = 0,
  nAcolhimentosUrgent = false,
  nAgenda1a = 0,
  gradeTab,
  agenda1aTab,
  fluxosTab,
  planosTab,
  inboxTab,
}: {
  nPlanos: number;
  nInbox: number;
  nFluxos: number;
  nAcolhimentos?: number;
  /** Piscar o badge da aba (laudo/guia aguardando validação do supervisor agora, agenda 13/09/2026). */
  nAcolhimentosUrgent?: boolean;
  nAgenda1a?: number;
  gradeTab: ReactNode;
  agenda1aTab?: ReactNode;
  fluxosTab: ReactNode;
  planosTab: ReactNode;
  inboxTab: ReactNode;
}) {
  const { tab, setCounts, setUrgent } = useSupervisaoTab();

  useEffect(() => {
    setCounts({ agenda1a: nAgenda1a + nAcolhimentos, fluxos: nFluxos, planos: nPlanos, inbox: nInbox });
  }, [nAgenda1a, nAcolhimentos, nFluxos, nPlanos, nInbox, setCounts]);

  useEffect(() => {
    setUrgent({ agenda1a: nAcolhimentosUrgent });
  }, [nAcolhimentosUrgent, setUrgent]);

  return (
    <PageContainer>
      {tab === "grade" ? <div key="tab-grade">{gradeTab}</div> : null}
      {tab === "agenda1a" ? <div key="tab-agenda1a">{agenda1aTab}</div> : null}
      {tab === "fluxos" ? <div key="tab-fluxos">{fluxosTab}</div> : null}
      {tab === "planos" ? <div key="tab-planos">{planosTab}</div> : null}
      {tab === "inbox" ? <div key="tab-inbox">{inboxTab}</div> : null}
    </PageContainer>
  );
}
