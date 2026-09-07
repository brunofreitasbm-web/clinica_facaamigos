import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getSuggestedGoals, getTeamSuggestions } from "@/lib/plan-suggestions";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

export default async function NovoPlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string }>;
}) {
  const { paciente } = await searchParams;
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .in("status", ["ativo", "avaliacao"])
    .order("full_name");

  // Prioridades da família (Módulo 3 MAAIS, slide 22) — pré-preenche o campo
  // do plano com o que a anamnese já registrou, pra não depender de alguém
  // lembrar de reler a anamnese na hora de montar o PTS.
  let familyPriorities: string | null = null;
  let suggestedGoals: Awaited<ReturnType<typeof getSuggestedGoals>> = [];
  let teamSuggestions: Awaited<ReturnType<typeof getTeamSuggestions>> = [];
  if (paciente) {
    const [{ data: anamnese }, goals, team] = await Promise.all([
      supabase
        .from("anamneses")
        .select("structured")
        .eq("patient_id", paciente)
        .order("conducted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getSuggestedGoals(supabase, DEV_CLINIC_ID, paciente),
      getTeamSuggestions(supabase, paciente),
    ]);
    familyPriorities = (anamnese?.structured as Record<string, string | null> | null)?.family_priorities ?? null;
    suggestedGoals = goals;
    teamSuggestions = team;
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Supervisão"
        title="Novo plano terapêutico"
        description="Objetivo geral, disciplinas, metas SMART por domínio (com horizonte, estratégia e metodologia) e data de revisão. O plano entra em rascunho e segue para a fila de aprovação."
      />
      <PlanForm
        patients={patients ?? []}
        initialPatientId={paciente ?? ""}
        initialFamilyPriorities={familyPriorities ?? ""}
        suggestedGoals={suggestedGoals}
        teamSuggestions={teamSuggestions}
      />
    </main>
  );
}
