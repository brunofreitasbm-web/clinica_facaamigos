import { Suspense } from "react";
import { GestorNav } from "@/components/gestor-nav";
import { EquipeSubnav } from "@/components/equipe-subnav";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { StaffTable } from "./staff-table";
import type { StaffRow, UnitOption } from "./types";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: units }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, council_type, unit_id, birth_date, active, is_evaluator, signature_pin_hash, source_system, created_at",
      )
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("full_name"),
    supabase.from("units").select("id, name").order("name"),
  ]);

  const unitOptions: UnitOption[] = (units ?? []).map((u) => ({ id: u.id, name: u.name }));
  const unitNameById = new Map(unitOptions.map((u) => [u.id, u.name]));

  const staff: StaffRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.role as Role,
    councilType: p.council_type,
    unitId: p.unit_id,
    unitName: p.unit_id ? unitNameById.get(p.unit_id) ?? p.unit_id : null,
    birthDate: p.birth_date,
    active: p.active ?? true,
    isEvaluator: p.is_evaluator ?? false,
    // O hash nunca sai do servidor — a tela só precisa saber se existe PIN
    // configurado pra habilitar (ou não) o botão de reset.
    hasSignaturePin: !!p.signature_pin_hash,
    sourceSystem: p.source_system,
    createdAtLabel: p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—",
  }));

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <GestorNav active="equipe" />
      <EquipeSubnav activeTab="colaboradores" />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-6 pt-8 sm:px-10">
          <h1 className="text-2xl font-bold text-ink">Colaboradores &amp; Contas</h1>
          <p className="text-sm text-ink-soft">
            Cadastro, papel de acesso (RBAC) e status de credencial de todo terapeuta da clínica.
            Quem vem do sistema de gestão de pessoas do Grupo IB entra aqui automaticamente, com
            unidade, e-mail e data de nascimento já preenchidos.
          </p>
        </div>
        <Suspense fallback={null}>
          <StaffTable staff={staff} units={unitOptions} />
        </Suspense>
      </main>
    </div>
  );
}
