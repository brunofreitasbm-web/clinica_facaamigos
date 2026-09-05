import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import { listInsurerReports } from "./actions";
import { ReportGenerator } from "./report-generator";

export const dynamic = "force-dynamic";

export default async function InsurerReportPage({
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

  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "relatorio_convenio");

  const history = await listInsurerReports(patientId);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Relatório de evolução para o convênio — ${patient.full_name}`}
        description="§8 Fase 2 do PRD: PDF gerado a partir das metas do plano aprovado e da frequência no período, pra anexar ao paciente e a recepção protocolar junto ao convênio na renovação de guia."
      />
      <div className="p-6 sm:p-10">
        <ReportGenerator patientId={patientId} initialHistory={history} />
      </div>
    </main>
  );
}
