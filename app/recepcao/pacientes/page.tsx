import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { computeStage, CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";

const STAGE_LABEL: Record<number, string> = {
  1: "Lead sem avaliação agendada",
  2: "Avaliação agendada, aguardando",
  3: "Avaliação feita, sem autorização",
  4: "Autorizado, sem grade montada",
  5: "Ativo — grade montada",
};

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const supabase = createAdminClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, status, created_at, evaluated_at, first_session_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name");

  const patientIds = (patients ?? []).map((p) => p.id);

  const { data: evalAppointments } = patientIds.length
    ? await supabase
        .from("appointments")
        .select("patient_id")
        .in("patient_id", patientIds)
        .eq("is_evaluation", true)
        .not("status", "in", `(${CANCELLED_APPOINTMENT_STATUSES.join(",")})`)
    : { data: [] as { patient_id: string }[] };

  const { data: activeAuths } = patientIds.length
    ? await supabase
        .from("authorizations")
        .select("id, patient_insurance!inner(patient_id)")
        .in("patient_insurance.patient_id", patientIds)
        .eq("status", "ativa")
    : { data: [] as { patient_insurance: { patient_id: string } | { patient_id: string }[] | null }[] };

  const evaluationScheduledIds = new Set((evalAppointments ?? []).map((a) => a.patient_id));
  const activeAuthPatientIds = new Set(
    (activeAuths ?? []).flatMap((a) => {
      const pi = a.patient_insurance;
      if (!pi) return [];
      return Array.isArray(pi) ? pi.map((x) => x.patient_id) : [pi.patient_id];
    }),
  );

  const rows = (patients ?? []).map((p) => ({
    ...p,
    stage: computeStage(p, evaluationScheduledIds.has(p.id), activeAuthPatientIds.has(p.id)),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Pacientes"
        description="Todos os pacientes da clínica, com estágio atual do cadastro contínuo."
      />
      <div className="flex flex-col gap-4 p-6 sm:p-10">
        <Link
          href="/recepcao/pacientes/novo"
          className="self-start rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
        >
          Novo paciente (lead)
        </Link>
        <div className="flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="text-sm text-ink-faint">Nenhum paciente cadastrado ainda.</p>
          )}
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/recepcao/pacientes/${p.id}`}
              className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm hover:border-chart"
            >
              <div>
                <p className="font-medium text-ink">{p.full_name}</p>
                <p className="text-ink-faint">{STAGE_LABEL[p.stage] ?? "Estágio desconhecido"}</p>
              </div>
              <span className="text-ink-faint">{p.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
