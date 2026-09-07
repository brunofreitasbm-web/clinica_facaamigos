import { GestorNav } from "@/components/gestor-nav";
import { EquipeSubnav } from "@/components/equipe-subnav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { StaffTable } from "./staff-table";
import type { StaffRow } from "./types";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, council_type, active, created_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const staff: StaffRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role as Role,
    councilType: p.council_type,
    active: p.active ?? true,
    createdAtLabel: p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—",
  }));

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <GestorNav active="equipe" />
      <EquipeSubnav activeTab="colaboradores" />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-6 pt-8 sm:px-10">
          <h1 className="text-2xl font-bold text-ink">Colaboradores & Contas</h1>
          <p className="text-sm text-ink-soft">
            Cadastro, papel de acesso (RBAC) e status de credencial de todo terapeuta da clínica.
          </p>
        </div>
        <StaffTable staff={staff} />
      </main>
    </div>
  );
}
