"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * As 5 abas de dados de /supervisao (Grade, Agenda 1ª Avaliação, Fluxos, PTS,
 * Caixa de entrada) trocam de conteúdo sem navegar — o conteúdo de cada uma é
 * pré-carregado só na page.tsx raiz (app/supervisao/page.tsx), então não tem
 * rota própria.
 *
 * "Planilha de Pacientes" (ex-aba "acolhimentos") não é mais uma aba deste
 * nível — virou sub-aba dentro de "Agenda 1ª Avaliação"
 * (agenda-avaliacoes-panel.tsx), junto de "Calendário" e "Entrada via
 * WhatsApp", porque as três são etapas do mesmo funil de 1ª avaliação e
 * ficavam em profundidades de navegação diferentes na barra rosa, confundindo
 * o supervisor (13/09/2026).
 *
 * O contexto agora vive no layout.tsx (10/09/2026), acima de toda a árvore
 * de /supervisao, não mais dentro da page.tsx raiz. Isso permite:
 * 1. O cabeçalho (components/supervisao-header.tsx) ficar persistente em
 *    TODAS as rotas do módulo, inclusive as 5 que hoje não tinham cabeçalho
 *    nenhum (disponibilidade, lista-espera, reagendamentos, reuniões,
 *    prontuário-unificado) ou tinham uma versão bespoke e desencontrada
 *    (lista-espera e prontuário-unificado, cada uma com seu próprio
 *    <header> e nome de módulo diferente).
 * 2. A aba selecionada sobreviver a uma ida-e-volta pra outra rota do
 *    módulo (antes resetava sempre pra "grade", porque o estado vivia
 *    dentro da própria page.tsx raiz, que desmontava ao navegar).
 *
 * "Grade" deixou de ser uma aba (14/09/2026) — virou redundante assim que
 * o botão "Agenda Manual" do cabeçalho passou a abrir o mesmo conteúdo em
 * tela cheia (ver manualScheduleOpen abaixo). Agora esse é o único ponto de
 * entrada pra grade semanal completa.
 */
export type SupervisaoTabKey = "agenda1a" | "fluxos" | "planos" | "inbox";

type Counts = Partial<Record<SupervisaoTabKey, number>>;
/** Abas com pendência que precisa de olhos AGORA (ex.: laudo aguardando validação do supervisor) ganham o badge piscante em vez do pill neutro. */
type UrgentFlags = Partial<Record<SupervisaoTabKey, boolean>>;

type Ctx = {
  tab: SupervisaoTabKey;
  setTab: (t: SupervisaoTabKey) => void;
  counts: Counts;
  setCounts: (c: Counts) => void;
  urgent: UrgentFlags;
  setUrgent: (u: UrgentFlags) => void;
  /** Botão "Agenda Manual" do cabeçalho — abre a grade semanal completa em
   * tela cheia por cima de qualquer rota do módulo (13/09/2026). O
   * conteúdo só é renderizado pela SupervisaoShell (raiz), então clicar no
   * botão fora de "/supervisao" primeiro navega pra lá e o flag já vem
   * ligado quando a shell montar. */
  manualScheduleOpen: boolean;
  setManualScheduleOpen: (v: boolean) => void;
};

const SupervisaoTabContext = createContext<Ctx>({
  tab: "agenda1a",
  setTab: () => {},
  counts: {},
  setCounts: () => {},
  urgent: {},
  setUrgent: () => {},
  manualScheduleOpen: false,
  setManualScheduleOpen: () => {},
});

/** Permite que um painel filho (ex.: atalhos da aba Fluxos) troque a aba ativa sem navegar. */
export function useSupervisaoTab() {
  return useContext(SupervisaoTabContext);
}

export function SupervisaoTabProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<SupervisaoTabKey>("agenda1a");
  const [counts, setCounts] = useState<Counts>({});
  const [urgent, setUrgent] = useState<UrgentFlags>({});
  const [manualScheduleOpen, setManualScheduleOpen] = useState(false);

  return (
    <SupervisaoTabContext.Provider
      value={{ tab, setTab, counts, setCounts, urgent, setUrgent, manualScheduleOpen, setManualScheduleOpen }}
    >
      {children}
    </SupervisaoTabContext.Provider>
  );
}
