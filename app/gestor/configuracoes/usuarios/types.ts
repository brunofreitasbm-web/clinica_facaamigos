export type UserRole = "gestor" | "recepcao" | "terapeuta" | "financeiro" | "admin";

export type SystemUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  discipline?: string | null;
  active: boolean;
  createdAt: string;
};
