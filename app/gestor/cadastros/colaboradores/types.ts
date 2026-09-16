import type { Role } from "@/lib/roles";

export type StaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  cpf: string | null;
  role: Role;
  councilType: string | null;
  /** ISO `yyyy-mm-dd`, como vem do Postgres e como o <input type="date"> espera. */
  birthDate: string | null;
  active: boolean;
  isEvaluator: boolean;
  /** Habilita o colaborador a abrir o módulo /at e registrar sessão de Acompanhamento Terapêutico. */
  isAtProfessional: boolean;
  googleCalendarOptIn: boolean;
  hasSignaturePin: boolean;
  /** `grupo_ib` quando o cadastro veio do sistema de gestão de pessoas. */
  sourceSystem: string | null;
  createdAtLabel: string;
};
