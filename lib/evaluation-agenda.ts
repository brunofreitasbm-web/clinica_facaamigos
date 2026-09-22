import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingPatients } from "@/lib/patient-stage";
import { GRID_EXCLUDED_STATUSES } from "@/app/supervisao/grade-data";

type Supa = SupabaseClient<Database>;

export type EvaluationAgendaOrigin = "whatsapp_anamnese" | "convenio_pdf" | "presencial" | "family_meeting" | "patient_feedback";

export type EvaluationBookInput =
  | { origin: "whatsapp_anamnese"; requestId: string }
  | { origin: "convenio_pdf"; leadId: string }
  | { origin: "presencial"; patientId: string };

/**
 * "Ok" de agendamento vindo da linha do tempo da Fila de pendências da Recepção
 * (documentos → guia enviada ao plano → autorização do plano → habilitado). Só
 * existe para paciente que entrou por um contato de documentos (registration_drafts):
 *  - "aguardando_envio_guia": a clínica ainda não enviou a guia ao plano (nem foi dispensada);
 *  - "aguardando_autorizacao": a guia foi enviada, o plano ainda não respondeu;
 *  - "aguardando_habilitacao": autorizado, falta a Recepção habilitar;
 *  - "habilitado": a Recepção deu o ok — pode marcar.
 */
export type EvaluationSchedulingGate =
  | "aguardando_envio_guia"
  | "aguardando_autorizacao"
  | "aguardando_habilitacao"
  | "habilitado";

/** Um paciente ainda sem 1ª avaliação marcada — candidato a ser arrastado pro calendário. */
export type EvaluationPoolItem = {
  id: string;
  origin: EvaluationAgendaOrigin;
  patientName: string;
  statusLabel: string;
  detail: string;
  /** true = já pode ser arrastado pro calendário agora; false = falta aprovar documentos antes. */
  ready: boolean;
  /** Preenchido só para contatos de documentos da Recepção; ver EvaluationSchedulingGate. */
  gate?: EvaluationSchedulingGate;
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
    .select("id, patient_full_name, status, created_at, extra")
    .not("status", "in", "(scheduled,cancelled,failed)")
    .order("created_at", { ascending: true });

  return (data ?? []).map((l) => {
    const isPresencial = (l.extra as Record<string, unknown> | null)?.is_presencial === true;
    return {
      id: `convenio-${l.id}`,
      origin: isPresencial ? ("presencial" as const) : ("convenio_pdf" as const),
      patientName: l.patient_full_name ?? "—",
      statusLabel: isPresencial ? "🚨 PRESENCIAL NA CLÍNICA" : (INTAKE_STATUS_LABEL[l.status] ?? l.status),
      detail: isPresencial ? "Presencial · docs conferidos na recepção" : "PDF de convênio",
      ready: isPresencial || l.status === "awaiting_slot",
      bookInput: { origin: "convenio_pdf", leadId: l.id },
    };
  });
}

/**
 * Situação, na linha do tempo da Recepção, de cada paciente que veio de um
 * contato de documentos (registration_drafts). Paciente sem contato aparece
 * fora do mapa — não tem "ok" a esperar. Havendo mais de um contato para o
 * mesmo paciente, basta um habilitado para liberar.
 */
export async function getSchedulingGates(supabase: Supa, patientIds: string[]): Promise<Map<string, EvaluationSchedulingGate>> {
  const gates = new Map<string, EvaluationSchedulingGate>();
  if (patientIds.length === 0) return gates;

  const { data } = await supabase
    .from("registration_drafts")
    .select("patient_id, status, guide_sent_at, plan_authorized_at, authorization_waived, scheduling_enabled_at")
    .in("patient_id", patientIds)
    .neq("status", "rejected");

  const rank: Record<EvaluationSchedulingGate, number> = {
    aguardando_envio_guia: 0,
    aguardando_autorizacao: 1,
    aguardando_habilitacao: 2,
    habilitado: 3,
  };
  for (const d of data ?? []) {
    if (!d.patient_id) continue;
    const gate: EvaluationSchedulingGate = d.scheduling_enabled_at
      ? "habilitado"
      : d.plan_authorized_at || d.authorization_waived
        ? "aguardando_habilitacao"
        : d.guide_sent_at
          ? "aguardando_autorizacao"
          : "aguardando_envio_guia";
    const current = gates.get(d.patient_id);
    if (!current || rank[gate] > rank[current]) gates.set(d.patient_id, gate);
  }
  return gates;
}

const GATE_STATUS_LABEL: Record<EvaluationSchedulingGate, string> = {
  aguardando_envio_guia: "Aguardando envio da guia ao plano",
  aguardando_autorizacao: "Guia enviada — aguardando o plano",
  aguardando_habilitacao: "Autorizado — aguardando a Recepção habilitar",
  habilitado: "Habilitado pela Recepção",
};

/**
 * Pacientes cadastrados presencialmente pela Recepção, sem draft de IA nem
 * origem em anamnese/convênio — identificados via getPendingPatients (mesma
 * regra de estágio usada na aba Fluxos), excluindo quem já apareceu nas
 * outras duas origens pra não contar o mesmo paciente duas vezes. Sempre
 * "ready" — não há aprovação de documentos pendente nesse caminho — salvo
 * quando o paciente veio de um contato de documentos, caso em que só fica
 * pronto com o "ok" da Recepção (getSchedulingGates).
 */
async function getPresencialPoolItems(supabase: Supa, coveredPatientIds: Set<string>): Promise<EvaluationPoolItem[]> {
  const pending = await getPendingPatients(supabase, 0);
  const candidates = pending.filter((p) => p.stage === 1 && !coveredPatientIds.has(p.id));
  const gates = await getSchedulingGates(
    supabase,
    candidates.map((p) => p.id),
  );

  return candidates.map((p) => {
    // Paciente que entrou por contato de documentos só é liberado depois do
    // "ok" da Recepção (linha do tempo da Fila de pendências).
    const gate = gates.get(p.id);
    return {
      id: `presencial-${p.id}`,
      origin: "presencial" as const,
      patientName: p.full_name,
      statusLabel: gate ? GATE_STATUS_LABEL[gate] : "🚨 PRESENCIAL NA CLÍNICA",
      detail: gate ? `Documentos por WhatsApp/portal · cadastrado há ${p.daysSinceCreated} dia(s)` : `Presencial · cadastrado há ${p.daysSinceCreated} dia(s)`,
      ready: !gate || gate === "habilitado",
      gate,
      bookInput: { origin: "presencial" as const, patientId: p.id },
    };
  });
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

  const presencialItems = await getPresencialPoolItems(supabase, new Set());

  const allItems = [...anamnesisItems, ...intakeItems, ...presencialItems];

  // Pacientes presenciais (origin === "presencial") sempre sobem pro TOPO da fila com prioridade alta!
  // Exceto quem veio de contato de documentos (gate): não está na clínica, e enquanto
  // a Recepção não habilita não pode furar a fila de quem já está pronto.
  const isPresencialNaClinica = (item: EvaluationPoolItem) => item.origin === "presencial" && !item.gate;
  allItems.sort((a, b) => {
    if (isPresencialNaClinica(a) && !isPresencialNaClinica(b)) return -1;
    if (!isPresencialNaClinica(a) && isPresencialNaClinica(b)) return 1;
    return 0;
  });

  return allItems;
}

/**
 * 1ª avaliações (+ reuniões com responsável de paciente já ativo, ver
 * appointments.is_family_meeting, e devolutivas do paciente marcadas pela
 * Supervisão, ver appointments.is_patient_feedback) já marcadas na agenda
 * dentro de uma janela [weekStartIso, weekEndIso), pra render do calendário
 * semanal. A origem de cada appointment é derivada checando
 * is_patient_feedback, depois is_family_meeting e, senão, se seu id aparece
 * em anamnesis_scheduling_requests/insurance_intake_leads — o que sobrar é
 * presencial (agendado direto pela Recepção, sem passar por WhatsApp/PDF).
 */
export async function getEvaluationCalendarAppointments(
  supabase: Supa,
  weekStartIso: string,
  weekEndIso: string,
): Promise<EvaluationCalendarAppointment[]> {
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, patient_id, therapist_id, is_family_meeting, is_patient_feedback, patients(full_name), therapist:profiles!therapist_id(full_name), rooms(name)",
    )
    .or("is_evaluation.eq.true,is_family_meeting.eq.true,is_patient_feedback.eq.true")
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
    const origin: EvaluationAgendaOrigin = a.is_patient_feedback
      ? "patient_feedback"
      : a.is_family_meeting
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
