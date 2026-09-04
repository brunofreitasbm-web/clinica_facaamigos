/**
 * Lista fixa de disciplinas — não existe protocolo/tabela configurável pra
 * isso ainda (só `domain_taxonomy`/`protocols`, sem seed). Compartilhada
 * entre o mix de disciplinas do plano e o select de disciplina de cada meta,
 * como pede o fluxo de criação.
 */
export const DISCIPLINES = [
  { value: "aba", label: "ABA" },
  { value: "fonoaudiologia", label: "Fonoaudiologia" },
  { value: "terapia_ocupacional", label: "Terapia ocupacional" },
  { value: "psicologia", label: "Psicologia" },
  { value: "psicopedagogia", label: "Psicopedagogia" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "denver_esdm", label: "Denver/ESDM" },
  { value: "outra", label: "Outra" },
] as const;

export type DisciplineValue = (typeof DISCIPLINES)[number]["value"];
