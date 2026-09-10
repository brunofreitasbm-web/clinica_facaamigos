import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { todayInTimeZone } from "@/lib/timezone";
import { evaluateAuthorizationWarning } from "@/lib/authorization-warning";
import { getPendingPatients } from "@/lib/patient-stage";
import { ChegadasList, type ChegadaItem } from "./chegadas-list";

const NON_ACTIVE_APPOINTMENT_STATUSES = [
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
  "falta_familia",
  "remarcada",
];

export const dynamic = "force-dynamic";

export default async function ChegadasPage() {
  const supabase = await createClient();
  const todayStr = todayInTimeZone(CLINIC_TIMEZONE);

  const { data: requests } = await supabase
    .from("checkin_requests")
    .select(
      "id, ticket_label, kind, match_quality, status, created_at, declared_first_name, declared_birth_date, patient_id, appointment_id, candidate_appointment_ids, patients(full_name)",
    )
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("service_date", todayStr)
    .order("created_at", { ascending: true });

  const pending = (requests ?? []).filter((r) => r.status === "aguardando");

  // Resolve nome/horário/status de: a sessão já vinculada + todas as
  // candidatas de casos ambíguos (gêmeos/duas sessões no dia) — uma única
  // consulta para não fazer N+1 por item da lista.
  const allAppointmentIds = Array.from(
    new Set(
      pending.flatMap((r) => [r.appointment_id, ...(r.candidate_appointment_ids ?? [])].filter((id): id is string => Boolean(id))),
    ),
  );

  const { data: appointmentsRaw } =
    allAppointmentIds.length > 0
      ? await supabase
          .from("appointments")
          .select(
            "id, starts_at, status, patient_id, authorization_id, is_provisional, is_evaluation, patients(full_name), therapist:profiles!therapist_id(full_name), authorizations(status, valid_from, valid_to, sessions_used, sessions_authorized, password_valid_until)",
          )
          .in("id", allAppointmentIds)
      : { data: [] };

  const appointmentById = new Map(
    (appointmentsRaw ?? []).map((a) => {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
      const authorizationRow = Array.isArray(a.authorizations) ? a.authorizations[0] : a.authorizations;
      const authorizationWarning = evaluateAuthorizationWarning(
        {
          authorizationId: a.authorization_id,
          isProvisional: a.is_provisional,
          isEvaluation: a.is_evaluation,
          authorization: authorizationRow
            ? {
                status: authorizationRow.status,
                validFrom: authorizationRow.valid_from,
                validTo: authorizationRow.valid_to,
                sessionsUsed: authorizationRow.sessions_used,
                sessionsAuthorized: authorizationRow.sessions_authorized,
                passwordValidUntil: authorizationRow.password_valid_until,
              }
            : null,
        },
        todayStr,
      );
      return [
        a.id,
        {
          id: a.id,
          startsAt: a.starts_at,
          status: a.status,
          patientId: a.patient_id,
          patientName: patient?.full_name ?? "—",
          therapistName: therapist?.full_name ?? "—",
          authorizationWarning,
        },
      ];
    }),
  );

  // Pendência de cadastro (mesma regra da fila de pendências) não bloqueia a
  // entrada da criança — só sinaliza pra recepção chamar o responsável
  // enquanto a sessão já corre, ver AGENTS.md / instrução do check-in por QR.
  const pendingPatients = await getPendingPatients(supabase);
  const registrationPendingPatientIds = new Set(pendingPatients.map((p) => p.id));

  const items: ChegadaItem[] = pending.map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const appointment = r.appointment_id ? appointmentById.get(r.appointment_id) ?? null : null;
    const eligibleForAutoConfirm =
      r.match_quality === "exato" &&
      r.kind === "agendado" &&
      Boolean(appointment) &&
      !NON_ACTIVE_APPOINTMENT_STATUSES.includes(appointment!.status) &&
      !appointment!.authorizationWarning;

    return {
      id: r.id,
      ticketLabel: r.ticket_label,
      kind: r.kind as "agendado" | "sem_agendamento",
      matchQuality: r.match_quality as ChegadaItem["matchQuality"],
      createdAt: r.created_at,
      declaredFirstName: r.declared_first_name,
      declaredBirthDate: r.declared_birth_date,
      patientId: r.patient_id,
      patientName: patient?.full_name ?? null,
      appointmentId: r.appointment_id,
      appointment,
      candidates: (r.candidate_appointment_ids ?? [])
        .map((id) => appointmentById.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
      eligibleForAutoConfirm,
      registrationPending: r.patient_id ? registrationPendingPatientIds.has(r.patient_id) : false,
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mb-4">
        <h1 style={{ fontFamily: "var(--font-heading)" }} className="text-xl font-semibold text-ink">
          Chegadas
        </h1>
        <p className="text-sm text-ink-soft">
          Pacientes que fizeram check-in pelo QR da entrada. A chamada segue o horário agendado, não a ordem de chegada.
        </p>
      </div>
      <ChegadasList initialItems={items} clinicId={DEV_CLINIC_ID} />
    </div>
  );
}
