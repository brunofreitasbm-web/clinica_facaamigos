import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getPatientProtocolTabs } from "@/lib/protocol-assessments";
import { ProtocolAssessmentPanel } from "@/components/protocol-assessment-panel";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

export default async function PatientAssessmentPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS de patients (patients_read) já garante que só quem tem acesso ao
  // paciente (terapeuta vinculado, supervisor, gestor) chega aqui.
  const { data: patient } = await supabase.from("patients").select("id, clinic_id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_protocolo");

  const protocols = await getPatientProtocolTabs(supabase, patient.clinic_id, patientId);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Avaliação de protocolo — ${patient.full_name}`}
        description="Checklist de marcos do protocolo licenciado (VB-MAPP/ABLLS-R/ESDM), pontuado a cada aplicação, com evolução por domínio."
      />
      <div className="p-6 sm:p-10">
        <ProtocolAssessmentPanel patientId={patient.id} protocols={protocols} />
      </div>
    </main>
  );
}
