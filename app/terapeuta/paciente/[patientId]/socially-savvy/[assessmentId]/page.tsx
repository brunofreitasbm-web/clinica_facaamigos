import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { getSociallySavvyAssessment } from "@/lib/socially-savvy-assessments";
import { SociallySavvyAssessmentForm } from "@/components/socially-savvy/assessment-form";
import { SociallySavvyAssessmentResults } from "@/components/socially-savvy/assessment-results";
import { SOCIALLY_SAVVY_LABEL } from "@/lib/socially-savvy";

export const dynamic = "force-dynamic";

export default async function SociallySavvyAssessmentDetailPage({
  params,
}: {
  params: Promise<{ patientId: string; assessmentId: string }>;
}) {
  const { patientId, assessmentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) redirect("/");

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  // RLS (socially_savvy_assessments_read) já garante o acesso; null vira 404,
  // nunca revelamos se o id existe para quem não pode vê-lo.
  const assessment = await getSociallySavvyAssessment(supabase, assessmentId);
  if (!assessment) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_socially_savvy");

  const isDraft = assessment.status === "rascunho";

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`${SOCIALLY_SAVVY_LABEL} — ${patient.full_name}`}
        description={
          isDraft
            ? `Aplicação ${assessment.round} · rascunho — continue o preenchimento e conclua quando estiver pronto.`
            : `Aplicação ${assessment.round} · concluída.`
        }
      />
      <div className="p-5 sm:p-10 print:p-0">
        {isDraft ? (
          <SociallySavvyAssessmentForm patientId={patientId} round={assessment.round} assessment={assessment} />
        ) : (
          <SociallySavvyAssessmentResults assessment={assessment} />
        )}
      </div>
    </main>
  );
}
