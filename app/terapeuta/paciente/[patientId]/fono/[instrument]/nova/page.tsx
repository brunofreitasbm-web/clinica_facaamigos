import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { AdlAssessmentForm } from "@/components/fono/adl-assessment-form";
import { ProcAssessmentForm } from "@/components/fono/proc-assessment-form";
import { FONO_INSTRUMENT_LABEL, getFonoBands, getFonoScaleLabels, isFonoInstrument } from "@/lib/fono-instruments";

export const dynamic = "force-dynamic";

export default async function NovaFonoAssessmentPage({
  params,
}: {
  params: Promise<{ patientId: string; instrument: string }>;
}) {
  const { patientId, instrument: instrumentParam } = await params;
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

  await logRecordAccess(supabase, patientId, "avaliacao_fono");

  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Nova aplicação — ${FONO_INSTRUMENT_LABEL[instrument]}`}
        description={`${patient.full_name} · preencha item a item; os totais e escores brutos são calculados automaticamente.`}
      />
      <div className="p-5 sm:p-10">
        {instrument === "proc" ? (
          <ProcAssessmentForm patientId={patientId} assessment={null} />
        ) : (
          <AdlAssessmentForm
            patientId={patientId}
            instrument={instrument}
            bands={getFonoBands(instrument)}
            receptiveLabel={getFonoScaleLabels(instrument).receptive}
            expressiveLabel={getFonoScaleLabels(instrument).expressive}
            assessment={null}
          />
        )}
      </div>
    </main>
  );
}
