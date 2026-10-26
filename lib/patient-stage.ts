import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID } from "@/lib/constants";

/**
 * Status de appointment que representam uma sessão que não vai acontecer
 * (cancelada ou remarcada) — nunca devem contar como "agendada"/"realizada"
 * pra fins de progresso de estágio do paciente.
 */
export const CANCELLED_APPOINTMENT_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "falta_familia",
  "remarcada",
] as const;

export function computeStage(
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

/**
 * Plano autorizado = apto à 1ª avaliação: o interessado vira paciente
 * ("avaliacao"). "ativo" só vem com a 1ª sessão da grade. Só promove quem ainda
 * é "interessado" — qualquer outro status é decisão da clínica e não se desfaz.
 * Falha aqui não derruba o registro da guia (já gravada), por isso só loga.
 */
export async function promoteToPatient(supabase: SupabaseClient<Database>, patientId: string | null | undefined): Promise<void> {
  if (!patientId) return;
  const { error } = await supabase
    .from("patients")
    .update({ status: "avaliacao" })
    .eq("id", patientId)
    .eq("status", "interessado");
  if (error) console.error("Erro ao promover interessado a paciente:", error);
}

/** Mesma promoção, partindo do id da guia (renovação responde só com `authorizations.id`). */
export async function promoteToPatientByAuthorization(supabase: SupabaseClient<Database>, authorizationId: string): Promise<void> {
  const { data } = await supabase
    .from("authorizations")
    .select("patient_insurance!inner(patient_id)")
    .eq("id", authorizationId)
    .maybeSingle();
  const pi = data?.patient_insurance as { patient_id: string } | { patient_id: string }[] | null | undefined;
  await promoteToPatient(supabase, Array.isArray(pi) ? pi[0]?.patient_id : pi?.patient_id);
}

export type PendingPatient = {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  evaluated_at: string | null;
  first_session_at: string | null;
  stage: 1 | 2 | 3 | 4 | 5;
  daysSinceCreated: number;
};

/**
 * Pacientes travados em algum estágio do cadastro contínuo há `daysThreshold`+
 * dias — mesma regra usada em `/recepcao/pacientes/pendencias` e na contagem
 * "Pendências" da home da recepção. Centralizada aqui pra não divergir.
 */
export async function getPendingPatients(
  supabase: SupabaseClient<Database>,
  daysThreshold = 3,
): Promise<PendingPatient[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, status, created_at, evaluated_at, first_session_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .neq("status", "ativo")
    .neq("status", "alta")
    .neq("status", "evadido");

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

  // Quem tem contato na esteira (registration_drafts) já é acompanhado lá —
  // pendente, autorizado, dispensado ou com agendamento liberado. Listar de novo
  // aqui duplicava a mesma família na fila de pendências.
  const { data: pipelineDrafts } = patientIds.length
    ? await supabase.from("registration_drafts").select("patient_id").in("patient_id", patientIds).neq("status", "rejected")
    : { data: [] as { patient_id: string | null }[] };
  const pipelinePatientIds = new Set((pipelineDrafts ?? []).map((d) => d.patient_id).filter((id): id is string => Boolean(id)));

  const evaluationScheduledIds = new Set((evalAppointments ?? []).map((a) => a.patient_id));
  const activeAuthPatientIds = new Set(
    (activeAuths ?? []).flatMap((a) => {
      const pi = a.patient_insurance;
      if (!pi) return [];
      return Array.isArray(pi) ? pi.map((x) => x.patient_id) : [pi.patient_id];
    }),
  );

  const now = Date.now();
  return (patients ?? [])
    .map((p) => ({
      ...p,
      stage: computeStage(p, evaluationScheduledIds.has(p.id), activeAuthPatientIds.has(p.id)),
      daysSinceCreated: Math.floor((now - new Date(p.created_at).getTime()) / 86_400_000),
    }))
    .filter((p) => p.stage < 4 && p.daysSinceCreated >= daysThreshold && !pipelinePatientIds.has(p.id))
    .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
}
