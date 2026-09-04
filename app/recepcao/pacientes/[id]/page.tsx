import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StageChecklist } from "@/components/stage-checklist";
import { createAdminClient } from "@/lib/supabase/admin";

function computeStage(
  patient: { status: string; evaluated_at: string | null; first_session_at: string | null },
  hasEvaluationScheduled: boolean,
  hasActiveAuthorization: boolean,
): 1 | 2 | 3 | 4 | 5 {
  if (patient.status === "ativo" || patient.first_session_at) return 5;
  if (hasActiveAuthorization) return 4;
  if (patient.evaluated_at) return 3;
  if (hasEvaluationScheduled || patient.status === "avaliacao") return 2;
  return 1;
}

export default async function PacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name, status, evaluated_at, first_session_at, entry_source, complaint")
    .eq("id", id)
    .maybeSingle();

  if (!patient || patientError) notFound();

  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, full_name, phone")
    .eq("patient_id", id);

  const { data: evalAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", id)
    .eq("is_evaluation", true)
    .limit(1)
    .maybeSingle();

  const { data: activeAuth } = await supabase
    .from("authorizations")
    .select("id, patient_insurance!inner(patient_id)")
    .eq("patient_insurance.patient_id", id)
    .eq("status", "ativa")
    .limit(1)
    .maybeSingle();

  const stage = computeStage(patient, !!evalAppointment, !!activeAuth);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title={patient.full_name}
        description={`Origem: ${patient.entry_source ?? "não informada"}`}
      />
      <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:p-10">
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Estágio</h2>
          <div className="mt-3">
            <StageChecklist stage={stage} />
          </div>
        </div>
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Responsáveis</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(guardians ?? []).map((g) => (
              <li key={g.id}>
                {g.full_name} — {g.phone}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
