import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { getFonoAssessment } from "@/lib/fono-assessments";
import { AdlAssessmentForm } from "@/components/fono/adl-assessment-form";
import { AdlAssessmentResults } from "@/components/fono/adl-assessment-results";
import { ProcAssessmentForm } from "@/components/fono/proc-assessment-form";
import { ProcAssessmentResults } from "@/components/fono/proc-assessment-results";
import { FONO_INSTRUMENT_LABEL, getFonoBands, getFonoScaleLabels, isFonoInstrument } from "@/lib/fono-instruments";

export const dynamic = "force-dynamic";

export default async function FonoAssessmentDetailPage({
  params,
}: {
  params: Promise<{ patientId: string; instrument: string; assessmentId: string }>;
}) {
  const { patientId, instrument: instrumentParam, assessmentId } = await params;
  if (!isFonoInstrument(instrumentParam)) notFound();
  const instrument = instrumentParam;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["terapeuta", "supervisor", "gestor"].includes(profile.role)) redirect("/");

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  // RLS (fono_assessments_read) já garante que só quem tem acesso ao
  // paciente/clínica chega aqui; null aqui vira 404, nunca revelamos se o
  // id existe para quem não tem acesso.
  const assessment = await getFonoAssessment(supabase, assessmentId);
  if (!assessment || assessment.instrument !== instrument) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_fono");

  const isDraft = assessment.status === "rascunho";

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`${FONO_INSTRUMENT_LABEL[instrument]} — ${patient.full_name}`}
        description={isDraft ? "Rascunho — continue o preenchimento e conclua quando estiver pronto." : "Avaliação concluída."}
      />
      <div className="p-5 sm:p-10 print:p-0">
        {instrument === "proc" ? (
          isDraft ? (
            <ProcAssessmentForm patientId={patientId} assessment={assessment} />
          ) : (
            <ProcAssessmentResults assessment={assessment} />
          )
        ) : isDraft ? (
          <AdlAssessmentForm
            patientId={patientId}
            instrument={instrument}
            bands={getFonoBands(instrument)}
            receptiveLabel={getFonoScaleLabels(instrument).receptive}
            expressiveLabel={getFonoScaleLabels(instrument).expressive}
            assessment={assessment}
          />
        ) : (
          <AdlAssessmentResults
            instrument={instrument}
            bands={getFonoBands(instrument)}
            receptiveLabel={getFonoScaleLabels(instrument).receptive}
            expressiveLabel={getFonoScaleLabels(instrument).expressive}
            assessment={assessment}
          />
        )}
      </div>
    </main>
  );
}
