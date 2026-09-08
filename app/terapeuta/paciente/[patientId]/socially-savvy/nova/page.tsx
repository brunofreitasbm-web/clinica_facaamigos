import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { SociallySavvyAssessmentForm } from "@/components/socially-savvy/assessment-form";
import { listPatientSociallySavvyAssessments } from "@/lib/socially-savvy-assessments";
import { SOCIALLY_SAVVY_LABEL, SOCIALLY_SAVVY_MAX_ROUNDS } from "@/lib/socially-savvy";

export const dynamic = "force-dynamic";

export default async function NovaSociallySavvyAssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ aplicacao?: string }>;
}) {
  const { patientId } = await params;
  const { aplicacao } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) redirect("/");

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  const existing = await listPatientSociallySavvyAssessments(supabase, patientId);
  const taken = new Set(existing.map((a) => a.round));

  const requested = Number(aplicacao);
  const round =
    Number.isInteger(requested) && requested >= 1 && requested <= SOCIALLY_SAVVY_MAX_ROUNDS
      ? requested
      : (Array.from({ length: SOCIALLY_SAVVY_MAX_ROUNDS }, (_, i) => i + 1).find((r) => !taken.has(r)) ?? 0);

  // Aplicação já existente ou ciclo completo: manda para o hub em vez de abrir
  // um formulário que o unique (patient_id, round) rejeitaria ao salvar.
  if (round === 0 || taken.has(round)) redirect(`/terapeuta/paciente/${patientId}/socially-savvy`);

  await logRecordAccess(supabase, patientId, "avaliacao_socially_savvy");

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Aplicação ${round} — ${SOCIALLY_SAVVY_LABEL}`}
        description={`${patient.full_name} · pontue habilidade a habilidade; áreas e PEI saem automaticamente.`}
      />
      <div className="p-5 sm:p-10">
        <SociallySavvyAssessmentForm patientId={patientId} round={round} assessment={null} />
      </div>
    </main>
  );
}
