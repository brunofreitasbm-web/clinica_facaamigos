"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { useSupervisaoTab, type SupervisaoTabKey } from "./supervisao-tab-context";

export type { SupervisaoTabKey };
export { useSupervisaoTab };

/**
 * Troca de conteúdo entre as 4 abas de dados de /supervisao. O cabeçalho
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
  const { tab, setCounts, setUrgent, manualScheduleOpen, setManualScheduleOpen } = useSupervisaoTab();

  useEffect(() => {
    setCounts({ agenda1a: nAgenda1a + nAcolhimentos, fluxos: nFluxos, planos: nPlanos, inbox: nInbox });
  }, [nAgenda1a, nAcolhimentos, nFluxos, nPlanos, nInbox, setCounts]);

  useEffect(() => {
    setUrgent({ agenda1a: nAcolhimentosUrgent });
  }, [nAcolhimentosUrgent, setUrgent]);

  return (
    <PageContainer>
      {/* "Grade" não é mais uma aba (14/09/2026) — gradeTab só aparece dentro
       * do overlay "Agenda" abaixo, que é agora o único ponto de entrada pra
       * grade semanal completa. */}
      {!manualScheduleOpen && tab === "agenda1a" ? <div key="tab-agenda1a">{agenda1aTab}</div> : null}
      {!manualScheduleOpen && tab === "fluxos" ? <div key="tab-fluxos">{fluxosTab}</div> : null}
      {!manualScheduleOpen && tab === "planos" ? <div key="tab-planos">{planosTab}</div> : null}
      {!manualScheduleOpen && tab === "inbox" ? <div key="tab-inbox">{inboxTab}</div> : null}

      {/* Agenda — grade semanal completa (todos terapeutas/salas/crianças da
       * semana) em tela cheia, acionada pelo botão do cabeçalho a partir de
       * qualquer rota do módulo (13/09/2026, renomeado de "Agenda Manual"
       * em 14/09/2026). Reaproveita o mesmo gradeTab já carregado por esta
       * page.tsx, então não refaz nenhuma busca ao servidor. O botão
       * "Editar" (permuta manual de pacientes) vive dentro do gradeTab —
       * ver grade-panel.tsx. */}
      {manualScheduleOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Agenda · grade semanal completa da clínica"
          className="fixed inset-0 z-[100] overflow-y-auto bg-paper"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-paper/95 px-6 py-3 backdrop-blur-sm" style={{ borderColor: "var(--color-divider)" }}>
            <span className="text-sm font-semibold text-ink-soft">Agenda · visão total da clínica</span>
            <button
              type="button"
              onClick={() => setManualScheduleOpen(false)}
              className="btn btn-secondary flex items-center gap-1.5 text-xs"
            >
              <X size={14} aria-hidden />
              Fechar
            </button>
          </div>
          <div className="p-6 sm:p-10">{gradeTab}</div>
        </div>
      )}
    </PageContainer>
  );
}
