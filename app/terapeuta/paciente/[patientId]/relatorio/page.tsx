import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ReportEditor, type DraftReportView } from "./report-editor";
import { logRecordAccess } from "@/lib/record-access-log";

export const dynamic = "force-dynamic";

export default async function RelatorioDevolutivoPage({
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
  const { data: patient } = await supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle();
  if (!patient) notFound();

  await logRecordAccess(supabase, patientId, "relatorio_devolutivo");

  const { data: latest } = await supabase
    .from("draft_reports")
    .select("id, period_start, period_end, ai_draft, final_text, status")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestReport: DraftReportView | null = latest
    ? {
        id: latest.id,
        periodStart: latest.period_start,
        periodEnd: latest.period_end,
        aiDraft: latest.ai_draft,
        finalText: latest.final_text,
        status: latest.status,
      }
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Terapeuta"
        title={`Relatório devolutivo — ${patient.full_name}`}
        description="A IA gera um rascunho a partir das evoluções e metas do período — revise e aprove antes de enviar."
      />
      <div className="p-6 sm:p-10">
        <ReportEditor patientId={patient.id} latestReport={latestReport} />
      </div>
    </main>
  );
}
