import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingPatients } from "@/lib/patient-stage";
import { GRID_EXCLUDED_STATUSES } from "@/app/supervisao/grade-data";
import type { PoolOffer } from "@/lib/evaluation-offer-badge-pure";
import { pickEvaluationRecipient, type GuardianContact } from "@/lib/evaluation-recipient-pure";

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
  /** Só para cadastro presencial: o que a Supervisão precisa pra escolher avaliador/horário. */
  facts?: EvaluationPoolFacts;
  /** Quem recebe o WhatsApp de confirmação ao agendar (null = ninguém com telefone). Mesma regra do envio. */
  recipient: EvaluationRecipientPreview | null;
  bookInput: EvaluationBookInput;
  /** Oferta automática por WhatsApp desta criança (viva ou que falhou) — alimenta a faixa de status do card. */
  offer?: PoolOffer;
};

export type EvaluationRecipientPreview = { name: string | null; phone: string };

export type EvaluationPoolFacts = {
  /** Nome do convênio, "Particular" ou null quando a Recepção ainda não informou. */
  insurer: string | null;
  /** "5 anos", "8 meses" — null sem data de nascimento válida. */
  age: string | null;
  waitingDays: number;
  guardianName?: string | null;
  phone?: string | null;
};

/** Uma 1ª avaliação já marcada na agenda, numa semana específica. */
export type EvaluationCalendarAppointment = {
  id: string;
  origin: EvaluationAgendaOrigin;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  roomId?: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  isProvisional?: boolean;
  /** Presente quando o horário foi escolhido pelo responsável na oferta automática do WhatsApp e aguarda o OK da Supervisão. */
  offerId?: string;
  /** Quando o responsável escolheu (ISO) — a agenda destaca escolhas recentes. */
  chosenAt?: string;
};

/**
 * Criança que recebeu a oferta automática de horários (evaluation_offers) e
 * ainda não tem horário confirmado: alimenta a lista "Aguardando responsável"
 * da barra lateral da agenda.
 */
export type EvaluationOfferItem = {
  id: string;
  patientId: string;
  patientName: string;
  status: "aguardando_interesse" | "aguardando_escolha" | "falhou" | "sem_horario";
  sentAt: string | null;
  reminderSentAt: string | null;
  lastError: string | null;
};

// `evaluation_offers` ainda não está em lib/database.types.ts (migration
// 20261029130000 precisa ser aplicada e os tipos regenerados).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const looseDb = (supabase: Supa) => supabase as unknown as SupabaseClient<any>;

/** Ofertas que a Supervisão precisa acompanhar (aguardando o responsável ou com problema no envio). */
export async function getEvaluationOffers(supabase: Supa): Promise<EvaluationOfferItem[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await looseDb(supabase)
    .from("evaluation_offers")
    .select("id, patient_id, status, sent_at, reminder_sent_at, last_error, created_at, patients(full_name)")
    .in("status", ["aguardando_interesse", "aguardando_escolha", "falhou", "sem_horario"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[evaluation-agenda] evaluation_offers:", error.message);
    return [];
  }
  type Row = {
    id: string;
    patient_id: string;
    status: EvaluationOfferItem["status"];
    sent_at: string | null;
    reminder_sent_at: string | null;
    last_error: string | null;
    patients: { full_name: string } | { full_name: string }[] | null;
  };
  const rows = (data ?? []) as Row[];
  // Falha antiga de quem já tem oferta viva (ou nova tentativa) não precisa aparecer.
  const live = new Set(rows.filter((r) => r.status === "aguardando_interesse" || r.status === "aguardando_escolha").map((r) => r.patient_id));
  return rows
    .filter((r) => (r.status === "falhou" || r.status === "sem_horario" ? !live.has(r.patient_id) : true))
    .map((r) => {
      const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
      return {
        id: r.id,
        patientId: r.patient_id,
        patientName: patient?.full_name ?? "—",
        status: r.status,
        sentAt: r.sent_at,
        reminderSentAt: r.reminder_sent_at,
        lastError: r.last_error,
      };
    });
}

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
    .select("id, child_name, status, created_at, guardian_phone")
    .in("status", ["pendente_supervisor", "aprovado"])
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: `anamnese-${r.id}`,
    origin: "whatsapp_anamnese",
    patientName: r.child_name,
    statusLabel: ANAMNESIS_STATUS_LABEL[r.status] ?? r.status,
    detail: "WhatsApp · anamnese",
    ready: r.status === "aprovado",
    recipient: r.guardian_phone?.trim() ? { name: null, phone: r.guardian_phone } : null,
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
    .select("id, patient_full_name, status, created_at, extra, phone_e164")
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
      recipient: l.phone_e164?.trim() ? { name: null, phone: l.phone_e164 } : null,
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

  const [{ data: drafts }, { data: activeAuths }] = await Promise.all([
    supabase
      .from("registration_drafts")
      .select("patient_id, status, guide_sent_at, plan_authorized_at, authorization_waived, scheduling_enabled_at")
      .in("patient_id", patientIds)
      .neq("status", "rejected"),
    supabase
      .from("authorizations")
      .select("patient_insurance!inner(patient_id)")
      .in("patient_insurance.patient_id", patientIds)
      .eq("status", "ativa"),
  ]);

  const patientsWithActiveAuth = new Set(
    (activeAuths ?? []).map((a: any) => a.patient_insurance?.patient_id).filter(Boolean)
  );

  const rank: Record<EvaluationSchedulingGate, number> = {
    aguardando_envio_guia: 0,
    aguardando_autorizacao: 1,
    aguardando_habilitacao: 2,
    habilitado: 3,
  };
  for (const d of drafts ?? []) {
    if (!d.patient_id) continue;
    const isPlanAuthorized = Boolean(
      d.plan_authorized_at || d.authorization_waived || d.scheduling_enabled_at || patientsWithActiveAuth.has(d.patient_id)
    );
    const gate: EvaluationSchedulingGate = isPlanAuthorized
      ? "habilitado"
      : d.guide_sent_at
        ? "aguardando_autorizacao"
        : "aguardando_envio_guia";
    const current = gates.get(d.patient_id);
    if (!current || rank[gate] > rank[current]) gates.set(d.patient_id, gate);
  }

  for (const pid of patientsWithActiveAuth) {
    if (!gates.has(pid)) {
      gates.set(pid, "habilitado");
    }
  }

  return gates;
}

const GATE_STATUS_LABEL: Record<EvaluationSchedulingGate, string> = {
  aguardando_envio_guia: "Aguardando envio da guia ao plano",
  aguardando_autorizacao: "Guia enviada — aguardando o plano",
  aguardando_habilitacao: "Autorizado — aguardando a Recepção habilitar",
  habilitado: "Plano autorizado / Habilitado",
};

/**
 * Pacientes cadastrados presencialmente pela Recepção, sem draft de IA nem
 * origem em anamnese/convênio — identificados via getPendingPatients (mesma
 * regra de estágio usada na aba Fluxos), excluindo quem já apareceu nas
 * outras duas origens pra não contar o mesmo paciente duas vezes. Sempre
 * "ready" quando autorizado pelo plano ou com status 'avaliacao', sem
 * avaliação realizada prévia e sem agendamento futuro ativo.
 */
async function getPresencialPoolItems(supabase: Supa, coveredPatientIds: Set<string>): Promise<EvaluationPoolItem[]> {
  const pending = await getPendingPatients(supabase, 0, { includeStage4: true, includePipelineDrafts: true });
  const candidates = pending.filter((p) => {
    if (coveredPatientIds.has(p.id)) return false;
    if (p.evaluated_at || p.first_session_at) return false;
    return p.stage === 1 || p.stage === 2 || p.stage === 4;
  });
  const candidateIds = candidates.map((p) => p.id);

  // Exclui apenas quem já possui agendamento ativo futuro de 1ª avaliação
  const { data: activeEvals } = candidateIds.length
    ? await supabase
        .from("appointments")
        .select("patient_id")
        .in("patient_id", candidateIds)
        .eq("is_evaluation", true)
        .in("status", ["agendada", "confirmada"])
    : { data: [] as { patient_id: string }[] };

  const activeEvalIds = new Set((activeEvals ?? []).map((a) => a.patient_id));
  const availableCandidates = candidates.filter((p) => !activeEvalIds.has(p.id));
  const availableCandidateIds = availableCandidates.map((p) => p.id);

  const [gates, profiles] = await Promise.all([
    getSchedulingGates(supabase, availableCandidateIds),
    getPoolPatientProfiles(supabase, availableCandidateIds),
  ]);

  return availableCandidates.map((p) => {
    const gate = gates.get(p.id);
    const profile = profiles.get(p.id);
    const isReady = !gate || gate === "habilitado" || p.status === "avaliacao";
    const isApto = gate === "habilitado" || p.status === "avaliacao";
    const statusLabel = isApto
      ? "Apto para 1ª avaliação"
      : gate
        ? GATE_STATUS_LABEL[gate]
        : "🚨 PRESENCIAL NA CLÍNICA";

    const detail = isApto
      ? "Apto para 1ª avaliação · plano autorizado"
      : gate
        ? `Documentos por WhatsApp/portal · cadastrado há ${p.daysSinceCreated} dia(s)`
        : `Cadastrado há ${p.daysSinceCreated} dia(s)`;

    return {
      id: `presencial-${p.id}`,
      origin: "presencial" as const,
      patientName: p.full_name,
      statusLabel,
      detail,
      ready: isReady,
      gate,
      facts: {
        insurer: profile?.insurer ?? null,
        age: profile?.age ?? null,
        waitingDays: p.daysSinceCreated,
        guardianName: profile?.guardianName ?? null,
        phone: profile?.phone ?? null,
      },
      recipient: profile?.recipient ?? null,
      bookInput: { origin: "presencial" as const, patientId: p.id },
    };
  });
}

type PoolPatientProfile = {
  insurer: string | null;
  age: string | null;
  guardianName: string | null;
  phone: string | null;
  recipient: EvaluationRecipientPreview | null;
};

/** Convênio, idade e contato do responsável dos candidatos da fila, numa consulta só. */
async function getPoolPatientProfiles(
  supabase: Supa,
  patientIds: string[],
): Promise<Map<string, PoolPatientProfile>> {
  const profiles = new Map<string, PoolPatientProfile>();
  if (patientIds.length === 0) return profiles;

  const [{ data: patientsData }, { data: guardiansData }, { data: draftsData }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, birth_date, patient_insurance(is_private, plan_name, insurers(name))")
      .in("id", patientIds),
    supabase
      .from("guardians")
      .select("patient_id, full_name, phone, is_financial")
      .in("patient_id", patientIds),
    supabase
      .from("registration_drafts")
      .select("patient_id, source_phone")
      .in("patient_id", patientIds),
  ]);

  const guardiansByPatientList = new Map<string, GuardianContact[]>();
  for (const g of guardiansData ?? []) {
    const list = guardiansByPatientList.get(g.patient_id) ?? [];
    list.push(g);
    guardiansByPatientList.set(g.patient_id, list);
  }

  const guardianByPatient = new Map<string, { name: string | null; phone: string | null }>();
  for (const g of guardiansData ?? []) {
    const existing = guardianByPatient.get(g.patient_id);
    if (!existing || g.is_financial) {
      guardianByPatient.set(g.patient_id, { name: g.full_name ?? null, phone: g.phone ?? null });
    }
  }

  const draftByPatient = new Map<string, { name: string | null; phone: string | null }>();
  for (const d of draftsData ?? []) {
    if (d.patient_id && !draftByPatient.has(d.patient_id)) {
      draftByPatient.set(d.patient_id, { name: null, phone: d.source_phone ?? null });
    }
  }

  for (const p of patientsData ?? []) {
    const coverages = Array.isArray(p.patient_insurance) ? p.patient_insurance : p.patient_insurance ? [p.patient_insurance] : [];
    const insurer =
      coverages
        .map((c) => {
          if (c.is_private) return "Particular";
          const ins = Array.isArray(c.insurers) ? c.insurers[0] : c.insurers;
          return ins?.name ?? c.plan_name ?? null;
        })
        .find(Boolean) ?? null;

    const gInfo = guardianByPatient.get(p.id) ?? draftByPatient.get(p.id);
    const recipient = pickEvaluationRecipient(guardiansByPatientList.get(p.id) ?? []);

    profiles.set(p.id, {
      insurer,
      age: formatChildAge(p.birth_date),
      guardianName: gInfo?.name ?? null,
      phone: gInfo?.phone ?? null,
      recipient: recipient ? { name: recipient.name, phone: recipient.phone } : null,
    });
  }
  return profiles;
}

function formatChildAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 24) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} anos`;
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

  // Paciente com oferta automática em andamento continua na fila: o card mostra
  // em que passo o responsável está, e agendar manualmente cancela a oferta
  // (releaseOfferForManualScheduling). Quem já escolheu horário tem agendamento
  // provisório e sai da fila pelo filtro de agendamento ativo.
  const [presencialItems, offers] = await Promise.all([getPresencialPoolItems(supabase, new Set()), getEvaluationOffers(supabase)]);
  const offerByPatient = new Map<string, PoolOffer>();
  for (const o of offers) {
    const live = o.status === "aguardando_interesse" || o.status === "aguardando_escolha";
    if (live || !offerByPatient.has(o.patientId)) {
      offerByPatient.set(o.patientId, { id: o.id, status: o.status, sentAt: o.sentAt, reminderSentAt: o.reminderSentAt, lastError: o.lastError });
    }
  }
  for (const item of presencialItems) {
    if (item.bookInput.origin === "presencial") item.offer = offerByPatient.get(item.bookInput.patientId);
  }

  // Paciente que veio por contato de documentos (WhatsApp/portal) só entra na
  // fila depois do "ok" da Recepção confirmando a autorização do plano.
  const allItems = [...anamnesisItems, ...intakeItems, ...presencialItems].filter((item) => !item.gate || item.gate === "habilitado" || item.ready);

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
      "id, starts_at, ends_at, patient_id, therapist_id, room_id, is_provisional, is_family_meeting, is_patient_feedback, patients(full_name), therapist:profiles!therapist_id(full_name), rooms(name)",
    )
    .or("is_evaluation.eq.true,is_family_meeting.eq.true,is_patient_feedback.eq.true")
    .gte("starts_at", weekStartIso)
    .lt("starts_at", weekEndIso)
    .not("status", "in", `(${GRID_EXCLUDED_STATUSES.join(",")})`)
    .order("starts_at", { ascending: true });

  const appointments = data ?? [];
  const ids = appointments.map((a) => a.id);

  const [{ data: anamnesisRows }, { data: intakeRows }, offerRes] = await Promise.all([
    ids.length
      ? createAdminClient().from("anamnesis_scheduling_requests").select("appointment_id").in("appointment_id", ids)
      : Promise.resolve({ data: [] as { appointment_id: string | null }[] }),
    ids.length
      ? supabase.from("insurance_intake_leads").select("appointment_id").in("appointment_id", ids)
      : Promise.resolve({ data: [] as { appointment_id: string | null }[] }),
    ids.length
      ? looseDb(supabase).from("evaluation_offers").select("id, appointment_id, chosen_at").eq("status", "aguardando_supervisor").in("appointment_id", ids)
      : Promise.resolve({ data: [] as { id: string; appointment_id: string; chosen_at: string | null }[], error: null }),
  ]);
  if (offerRes.error) console.error("[evaluation-agenda] evaluation_offers:", offerRes.error.message);
  const offerByAppointment = new Map(
    ((offerRes.data ?? []) as { id: string; appointment_id: string; chosen_at: string | null }[]).map((o) => [o.appointment_id, o]),
  );

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
      roomId: a.room_id,
      roomName: room?.name ?? "—",
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      isProvisional: Boolean(a.is_provisional),
      offerId: offerByAppointment.get(a.id)?.id,
      chosenAt: offerByAppointment.get(a.id)?.chosen_at ?? undefined,
    };
  });
}
