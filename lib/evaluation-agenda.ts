import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingPatients } from "@/lib/patient-stage";

type Supa = SupabaseClient<Database>;

export type EvaluationAgendaOrigin = "whatsapp_anamnese" | "convenio_pdf" | "presencial";
export type EvaluationAgendaPhase = "aguardando" | "agendado";

export type EvaluationAgendaItem = {
  id: string;
  origin: EvaluationAgendaOrigin;
  patientId: string | null;
  patientName: string;
  phase: EvaluationAgendaPhase;
  statusLabel: string;
  detail: string;
  scheduledAt: string | null;
  /** Aba do supervisor onde a ação (aprovar/rejeitar) acontece — null para presencial, que não tem fila própria. */
  jumpToTab: "triagens" | "acolhimentos" | null;
};

const ANAMNESIS_STATUS_LABEL: Record<string, string> = {
  pendente_supervisor: "Documentação para validar",
  aprovado: "Aguardando resposta da família",
  agendado: "Agendado",
};

const INTAKE_STATUS_LABEL: Record<string, string> = {
  extracted: "Para revisar",
  approved: "Aprovado",
  awaiting_documents: "Em contato — aguardando docs",
  pending_supervisor: "Documentos para validar",
  awaiting_slot: "Aguardando horário",
  scheduled: "Agendado",
};

/**
 * Anamnese/avaliação vindas do bot de WhatsApp genérico (anamnesis_scheduling_requests).
 * RLS dessa tabela só libera service_role (policy anamnesis_requests_admin), por isso
 * usa createAdminClient() — mesmo padrão de getPendingAnamnesisRequestsAction.
 */
async function getAnamnesisAgendaItems(): Promise<{ items: EvaluationAgendaItem[]; patientIdsCovered: Set<string> }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("anamnesis_scheduling_requests")
    .select("id, child_name, status, created_at, patient_id, appointment_id, selected_slot_starts_at")
    .order("created_at", { ascending: true });

  const items: EvaluationAgendaItem[] = [];
  const patientIdsCovered = new Set<string>();

  for (const r of data ?? []) {
    if (r.patient_id) patientIdsCovered.add(r.patient_id);
    if (r.status !== "pendente_supervisor" && r.status !== "aprovado" && r.status !== "agendado") continue;

    const phase: EvaluationAgendaPhase = r.status === "agendado" ? "agendado" : "aguardando";
    items.push({
      id: `anamnese-${r.id}`,
      origin: "whatsapp_anamnese",
      patientId: r.patient_id,
      patientName: r.child_name,
      phase,
      statusLabel: ANAMNESIS_STATUS_LABEL[r.status] ?? r.status,
      detail: "WhatsApp · anamnese",
      scheduledAt: phase === "agendado" ? r.selected_slot_starts_at : null,
      jumpToTab: "triagens",
    });
  }

  return { items, patientIdsCovered };
}

/**
 * Acolhimentos vindos de PDF de convênio (+ continuidade por WhatsApp) — insurance_intake_leads.
 * RLS já libera supervisor, por isso usa o client normal recebido por parâmetro.
 */
async function getIntakeAgendaItems(
  supabase: Supa,
): Promise<{ items: EvaluationAgendaItem[]; patientIdsCovered: Set<string> }> {
  const { data } = await supabase
    .from("insurance_intake_leads")
    .select("id, patient_id, patient_full_name, status, created_at, appointment_id, appointments(starts_at)")
    .not("status", "in", "(cancelled,failed)")
    .order("created_at", { ascending: true });

  const items: EvaluationAgendaItem[] = [];
  const patientIdsCovered = new Set<string>();

  for (const l of data ?? []) {
    if (l.patient_id) patientIdsCovered.add(l.patient_id);
    const appointment = Array.isArray(l.appointments) ? l.appointments[0] : l.appointments;
    const phase: EvaluationAgendaPhase = l.status === "scheduled" ? "agendado" : "aguardando";
    items.push({
      id: `convenio-${l.id}`,
      origin: "convenio_pdf",
      patientId: l.patient_id,
      patientName: l.patient_full_name ?? "—",
      phase,
      statusLabel: INTAKE_STATUS_LABEL[l.status] ?? l.status,
      detail: "PDF de convênio",
      scheduledAt: phase === "agendado" ? (appointment?.starts_at ?? null) : null,
      jumpToTab: "acolhimentos",
    });
  }

  return { items, patientIdsCovered };
}

/**
 * Pacientes cadastrados presencialmente pela Recepção, sem draft de IA nem
 * origem em anamnese/convênio — identificados via getPendingPatients (mesma
 * regra de estágio usada na aba Fluxos), excluindo quem já apareceu nas
 * outras duas origens pra não contar o mesmo paciente duas vezes.
 */
async function getPresencialAgendaItems(supabase: Supa, coveredPatientIds: Set<string>): Promise<EvaluationAgendaItem[]> {
  const pending = await getPendingPatients(supabase, 0);

  return pending
    .filter((p) => (p.stage === 1 || p.stage === 2) && !coveredPatientIds.has(p.id))
    .map((p) => ({
      id: `presencial-${p.id}`,
      origin: "presencial" as const,
      patientId: p.id,
      patientName: p.full_name,
      phase: (p.stage === 2 ? "agendado" : "aguardando") as EvaluationAgendaPhase,
      statusLabel: p.stage === 2 ? "Agendado" : "Aguardando agendamento",
      detail: `Presencial · cadastrado há ${p.daysSinceCreated} dia(s)`,
      scheduledAt: null,
      jumpToTab: null,
    }));
}

/**
 * Fila única de 1ª avaliação/anamnese/acolhimento (Supervisor), agregando as
 * três origens possíveis de um paciente novo: bot de WhatsApp de anamnese,
 * acolhimento por PDF de convênio, e cadastro presencial pela Recepção.
 * Segue o mesmo padrão de agregação de lib/reception-queue.ts.
 */
export async function getEvaluationAgenda(supabase: Supa, clinicId: string = DEV_CLINIC_ID): Promise<EvaluationAgendaItem[]> {
  void clinicId; // as três fontes já são escopadas por clínica em suas próprias queries/RLS

  const [anamnesis, intake] = await Promise.all([getAnamnesisAgendaItems(), getIntakeAgendaItems(supabase)]);

  const coveredPatientIds = new Set<string>([...anamnesis.patientIdsCovered, ...intake.patientIdsCovered]);
  const presencial = await getPresencialAgendaItems(supabase, coveredPatientIds);

  const items = [...anamnesis.items, ...intake.items, ...presencial];

  return items.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === "agendado" ? -1 : 1;
    if (a.phase === "agendado") return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
    return 0;
  });
}
