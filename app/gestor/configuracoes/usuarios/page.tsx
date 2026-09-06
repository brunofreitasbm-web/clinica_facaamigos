import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { UsuariosManager } from "./usuarios-manager";
import type { SystemUserRow, UserRole } from "./types";

export const dynamic = "force-dynamic";

const ROLE_LABEL_MAP: Record<string, string> = {
  gestor: "Gestor",
  recepcao: "Recepção",
  terapeuta: "Terapeuta",
  financeiro: "Financeiro",
  admin: "Administrador",
};

const DEFAULT_USERS_FALLBACK: SystemUserRow[] = [
  {
    id: "usr-1",
    name: "Bruno Freitas",
    email: "bruno@clinicafacaamigos.com.br",
    role: "gestor",
    roleLabel: "Gestor",
    discipline: "Administração Clínica",
    active: true,
    createdAt: "01/01/2026",
  },
  {
    id: "usr-2",
    name: "Dra. Ana Paula Souza",
    email: "ana.souza@clinicafacaamigos.com.br",
    role: "terapeuta",
    roleLabel: "Terapeuta",
    discipline: "CRP 06/142910 (Psicologia ABA)",
    active: true,
    createdAt: "15/01/2026",
  },
  {
    id: "usr-3",
    name: "Camila Ribeiro",
    email: "recepcao@clinicafacaamigos.com.br",
    role: "recepcao",
    roleLabel: "Recepção",
    discipline: "Atendimento & Recepção",
    active: true,
    createdAt: "20/01/2026",
  },
  {
    id: "usr-4",
    name: "Ricardo Martins",
    email: "financeiro@clinicafacaamigos.com.br",
    role: "financeiro",
    roleLabel: "Financeiro",
    discipline: "Gestão Financeira & TISS",
    active: true,
    createdAt: "05/02/2026",
  },
  {
    id: "usr-5",
    name: "Dr. Marcelo Costa",
    email: "marcelo.costa@clinicafacaamigos.com.br",
    role: "terapeuta",
    roleLabel: "Terapeuta",
    discipline: "CRFa 2-18490 (Fonoaudiologia)",
    active: false,
    createdAt: "10/02/2026",
  },
];

export default async function UsuariosConfigPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, council_type, active, created_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const users: SystemUserRow[] =
    profiles && profiles.length > 0
      ? profiles.map((p) => ({
          id: p.id,
          name: p.full_name,
          email: `${p.full_name.toLowerCase().replace(/\s+/g, ".")}@clinicafacaamigos.com.br`,
          role: (p.role as UserRole) || "terapeuta",
          roleLabel: ROLE_LABEL_MAP[p.role ?? "terapeuta"] ?? p.role,
          discipline: p.council_type,
          active: p.active ?? true,
          createdAt: p.created_at
            ? new Date(p.created_at).toLocaleDateString("pt-BR")
            : new Date().toLocaleDateString("pt-BR"),
        }))
      : DEFAULT_USERS_FALLBACK;

  return (
    <main className="flex flex-1 flex-col">
      <UsuariosManager users={users} />
    </main>
  );
}
