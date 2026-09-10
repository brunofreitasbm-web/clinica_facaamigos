"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * As 6 abas de dados de /supervisao (Grade, Agenda 1ª Avaliação, Planilha de
 * Pacientes, Fluxos, PTS, Caixa de entrada) trocam de conteúdo sem navegar —
 * o conteúdo de cada uma é pré-carregado só na page.tsx raiz (app/supervisao/
 * page.tsx), então não tem rota própria.
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
 */
export type SupervisaoTabKey = "grade" | "agenda1a" | "acolhimentos" | "fluxos" | "planos" | "inbox";

type Counts = Partial<Record<SupervisaoTabKey, number>>;

type Ctx = {
  tab: SupervisaoTabKey;
  setTab: (t: SupervisaoTabKey) => void;
  counts: Counts;
  setCounts: (c: Counts) => void;
};

const SupervisaoTabContext = createContext<Ctx>({
  tab: "grade",
  setTab: () => {},
  counts: {},
  setCounts: () => {},
});

/** Permite que um painel filho (ex.: atalhos da aba Fluxos) troque a aba ativa sem navegar. */
export function useSupervisaoTab() {
  return useContext(SupervisaoTabContext);
}

export function SupervisaoTabProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<SupervisaoTabKey>("grade");
  const [counts, setCounts] = useState<Counts>({});

  return (
    <SupervisaoTabContext.Provider value={{ tab, setTab, counts, setCounts }}>{children}</SupervisaoTabContext.Provider>
  );
}
