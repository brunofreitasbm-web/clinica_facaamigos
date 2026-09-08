import type { Role } from "@/lib/roles";

export type StaffRow = {
  id: string;
  fullName: string;
  role: Role;
  councilType: string | null;
  active: boolean;
  isEvaluator: boolean;
  createdAtLabel: string;
};
