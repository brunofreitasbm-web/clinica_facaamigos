import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { getPlaygroundDetail } from "@/lib/playground/detail";
import { PlaygroundAssessmentDetail } from "@/components/playground/assessment-detail";

export const dynamic = "force-dynamic";

export default async function PatientPlaygroundPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS de patients já garante que só quem tem acesso ao paciente chega aqui.
  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "avaliacao_protocolo");

  const series = await getPlaygroundDetail(supabase, patientId);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Avaliação do playground — ${patient.full_name}`}
        description="VB-MAPP preenchido pelos terapeutas do playground ao longo das visitas, com autor e especialidade de cada item."
      />
      <div className="p-6 sm:p-10">
        <PlaygroundAssessmentDetail series={series} />
      </div>
    </main>
  );
}
