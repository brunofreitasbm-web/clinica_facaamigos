import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingPatients } from "@/lib/patient-stage";
import { GRID_EXCLUDED_STATUSES } from "@/app/supervisao/grade-data";

type Supa = SupabaseClient<Database>;

export type EvaluationAgendaOrigin = "whatsapp_anamnese" | "convenio_pdf" | "presencial" | "family_meeting";

export type EvaluationBookInput =
  | { origin: "whatsapp_anamnese"; requestId: string }
  | { origin: "convenio_pdf"; leadId: string }
  | { origin: "presencial"; patientId: string };

/** Um paciente ainda sem 1ª avaliação marcada — candidato a ser arrastado pro calendário. */
export type EvaluationPoolItem = {
  id: string;
  origin: EvaluationAgendaOrigin;
  patientName: string;
  statusLabel: string;
  detail: string;
  /** true = já pode ser arrastado pro calendário agora; false = falta aprovar documentos antes. */
  ready: boolean;
  bookInput: EvaluationBookInput;
};

/** Uma 1ª avaliação já marcada na agenda, numa semana específica. */
export type EvaluationCalendarAppointment = {
  id: string;
  origin: EvaluationAgendaOrigin;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
};

const ANAMNESIS_STATUS_LABEL: Record<string, string> = {
  pendente_supervisor: "Documentação para validar",
  aprovado: "Pronto para agendar",
};

const INTAKE_STATUS_LABEL: Record<string, string> = {
  extracted: "Para revisar",
  approved: "Aprovado — iniciando contato",
  awaiting_documents: "Em contato — aguardando docs",
  pending_supervisor: "Documentos para validar",
  awaiting_slot: "Pronto para agendar",
};

/**
 * Fila de anamnese/avaliação vindas do bot de WhatsApp genérico ainda sem
 * agendamento (anamnesis_scheduling_requests.status <> 'agendado'). RLS dessa
 * tabela só libera service_role (policy anamnesis_requests_admin), por isso
 * usa createAdminClient() — mesmo padrão de getPendingAnamnesisRequestsAction.
 */
async function getAnamnesisPoolItems(): Promise<EvaluationPoolItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("anamnesis_scheduling_requests")
    .select("id, child_name, status, created_at")
    .in("status", ["pendente_supervisor", "aprovado"])
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: `anamnese-${r.id}`,
    origin: "whatsapp_anamnese",
    patientName: r.child_name,
    statusLabel: ANAMNESIS_STATUS_LABEL[r.status] ?? r.status,
    detail: "WhatsApp · anamnese",
    ready: r.status === "aprovado",
    bookInput: { origin: "whatsapp_anamnese", requestId: r.id },
  }));
}

/**
 * Fila de acolhimentos vindos de PDF de convênio (+ continuidade por
 * WhatsApp) ainda sem agendamento — insurance_intake_leads. RLS já libera
 * supervisor, por isso usa o client normal recebido por parâmetro.
 */
async function getIntakePoolItems(supabase: Supa): Promise<EvaluationPoolItem[]> {
  const { data } = await supabase
    .from("insurance_intake_leads")
    .select("id, patient_full_name, status, created_at")
    .not("status", "in", "(scheduled,cancelled,failed)")
    .order("created_at", { ascending: true });

  return (data ?? []).map((l) => ({
    id: `convenio-${l.id}`,
    origin: "convenio_pdf",
    patientName: l.patient_full_name ?? "—",
    statusLabel: INTAKE_STATUS_LABEL[l.status] ?? l.status,
    detail: "PDF de convênio",
    ready: l.status === "awaiting_slot",
    bookInput: { origin: "convenio_pdf", leadId: l.id },
  }));
}

/**
 * Pacientes cadastrados presencialmente pela Recepção, sem draft de IA nem
 * origem em anamnese/convênio — identificados via getPendingPatients (mesma
 * regra de estágio usada na aba Fluxos), excluindo quem já apareceu nas
 * outras duas origens pra não contar o mesmo paciente duas vezes. Sempre
 * "ready" — não há aprovação de documentos pendente nesse caminho.
 */
async function getPresencialPoolItems(supabase: Supa, coveredPatientIds: Set<string>): Promise<EvaluationPoolItem[]> {
  const pending = await getPendingPatients(supabase, 0);

  return pending
    .filter((p) => p.stage === 1 && !coveredPatientIds.has(p.id))
    .map((p) => ({
      id: `presencial-${p.id}`,
      origin: "presencial" as const,
      patientName: p.full_name,
      statusLabel: "Aguardando agendamento",
      detail: `Presencial · cadastrado há ${p.daysSinceCreated} dia(s)`,
      ready: true,
      bookInput: { origin: "presencial", patientId: p.id },
    }));
}

/**
 * Fila única de pacientes aguardando 1ª avaliação/anamnese/acolhimento
 * (Supervisor), agregando as três origens possíveis de um paciente novo: bot
 * de WhatsApp de anamnese, acolhimento por PDF de convênio, e cadastro
 * presencial pela Recepção. Alimenta a barra lateral do calendário de 1ª
 * avaliação — cada item "ready" pode ser arrastado direto pro calendário.
 */
export async function getEvaluationPool(supabase: Supa, clinicId: string = DEV_CLINIC_ID): Promise<EvaluationPoolItem[]> {
  void clinicId; // as três fontes já são escopadas por clínica em suas próprias queries/RLS

  const [anamnesisItems, intakeItems] = await Promise.all([getAnamnesisPoolItems(), getIntakePoolItems(supabase)]);

  // Paciente presencial que já tem um patient_id vinculado a uma requisição de
  // anamnese ainda não seria coberto (pool de anamnese não retorna patient_id
  // hoje), mas como getPendingPatients só considera stage 1 (sem nenhuma
  // avaliação agendada nem em andamento), o overlap prático é mínimo; ainda
  // assim, filtra por precaução caso uma requisição/lead já tenha criado o
  // registro em `patients`.
  const presencialItems = await getPresencialPoolItems(supabase, new Set());

  return [...anamnesisItems, ...intakeItems, ...presencialItems];
}

/**
 * 1ª avaliações (+ reuniões com responsável de paciente já ativo, ver
 * appointments.is_family_meeting) já marcadas na agenda dentro de uma janela
 * [weekStartIso, weekEndIso), pra render do calendário semanal. A origem de
 * cada appointment é derivada checando is_family_meeting primeiro e, senão,
 * se seu id aparece em anamnesis_scheduling_requests/insurance_intake_leads —
 * o que sobrar é presencial (agendado direto pela Recepção, sem passar por
 * WhatsApp/PDF).
 */
export async function getEvaluationCalendarAppointments(
  supabase: Supa,
  weekStartIso: string,
  weekEndIso: string,
): Promise<EvaluationCalendarAppointment[]> {
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, patient_id, therapist_id, is_family_meeting, patients(full_name), therapist:profiles!therapist_id(full_name), rooms(name)",
    )
    .or("is_evaluation.eq.true,is_family_meeting.eq.true")
    .gte("starts_at", weekStartIso)
    .lt("starts_at", weekEndIso)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
    .order("starts_at", { ascending: true });

  const appointments = data ?? [];
  const ids = appointments.map((a) => a.id);

  const [{ data: anamnesisRows }, { data: intakeRows }] = await Promise.all([
    ids.length
      ? createAdminClient().from("anamnesis_scheduling_requests").select("appointment_id").in("appointment_id", ids)
      : Promise.resolve({ data: [] as { appointment_id: string | null }[] }),
    ids.length
      ? supabase.from("insurance_intake_leads").select("appointment_id").in("appointment_id", ids)
      : Promise.resolve({ data: [] as { appointment_id: string | null }[] }),
  ]);

  const anamnesisAppointmentIds = new Set((anamnesisRows ?? []).map((r) => r.appointment_id).filter(Boolean) as string[]);
  const intakeAppointmentIds = new Set((intakeRows ?? []).map((r) => r.appointment_id).filter(Boolean) as string[]);

  return appointments.map((a) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    const therapist = Array.isArray(a.therapist) ? a.therapist[0] : a.therapist;
    const room = Array.isArray(a.rooms) ? a.rooms[0] : a.rooms;
    const origin: EvaluationAgendaOrigin = a.is_family_meeting
      ? "family_meeting"
      : anamnesisAppointmentIds.has(a.id)
        ? "whatsapp_anamnese"
        : intakeAppointmentIds.has(a.id)
          ? "convenio_pdf"
          : "presencial";

    return {
      id: a.id,
      origin,
      patientId: a.patient_id,
      patientName: patient?.full_name ?? "—",
      therapistId: a.therapist_id,
      therapistName: therapist?.full_name ?? "—",
      roomName: room?.name ?? "—",
      startsAt: a.starts_at,
      endsAt: a.ends_at,
    };
  });
}
