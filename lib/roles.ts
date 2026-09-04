export const ROLES = [
  "gestor",
  "supervisor",
  "terapeuta",
  "recepcao",
  "faturamento",
  "responsavel",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  gestor: "Gestor",
  supervisor: "Supervisão",
  terapeuta: "Terapeuta",
  recepcao: "Recepção",
  faturamento: "Faturamento",
  responsavel: "Família",
};

export const ROLE_HOME: Record<Role, string> = {
  gestor: "/gestor",
  supervisor: "/supervisao",
  terapeuta: "/terapeuta",
  recepcao: "/recepcao",
  faturamento: "/faturamento",
  responsavel: "/familia",
};
