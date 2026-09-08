import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { computeStage, CANCELLED_APPOINTMENT_STATUSES } from "@/lib/patient-stage";
import { PatientListClient } from "./patient-list-client";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const supabase = await createClient();

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
      <PatientListClient rows={rows} />
    </main>
  );
}
