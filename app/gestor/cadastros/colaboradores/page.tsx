import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { StaffTable } from "./staff-table";
import type { StaffRow } from "./types";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let clinicId = DEV_CLINIC_ID;
  if (user) {
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .maybeSingle();
    if (callerProfileError) {
      console.error("[colaboradores] falha ao buscar perfil do usuário logado:", callerProfileError);
    }
    if (callerProfile?.clinic_id) {
      clinicId = callerProfile.clinic_id;
    }
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, cpf, role, council_type, birth_date, active, is_evaluator, is_at_professional, google_calendar_opt_in, signature_pin_hash, source_system, created_at",
    )
    .eq("clinic_id", clinicId)
    .order("full_name");

  if (profilesError) {
    console.error("[colaboradores] falha ao listar colaboradores:", profilesError);
  }

  const staff: StaffRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    cpf: p.cpf,
    role: p.role as Role,
    councilType: p.council_type,
    birthDate: p.birth_date,
    active: p.active ?? true,
    isEvaluator: p.is_evaluator ?? false,
    isAtProfessional: p.is_at_professional ?? false,
    googleCalendarOptIn: p.google_calendar_opt_in ?? false,
    // O hash nunca sai do servidor — a tela só precisa saber se existe PIN
    // configurado pra habilitar (ou não) o botão de reset.
    hasSignaturePin: !!p.signature_pin_hash,
    sourceSystem: p.source_system,
    createdAtLabel: p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—",
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <main className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Cadastros"
          title="Colaboradores & Contas"
          description="Cadastro, papel de acesso (RBAC) e status de credencial de todo terapeuta da clínica. Quem vem do sistema de gestão de pessoas do Grupo IB entra aqui automaticamente, com e-mail e data de nascimento já preenchidos."
        />
        <Suspense fallback={null}>
          <StaffTable staff={staff} />
        </Suspense>
      </main>
    </div>
  );
}
