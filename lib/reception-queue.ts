import { cache } from "react";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone } from "@/lib/timezone";
import { getPendingPatients } from "@/lib/patient-stage";
import { listOverdueSessionNotes } from "@/lib/session-note-pending";
import { createClient } from "@/lib/supabase/server";

type Supa = SupabaseClient<Database>;

export type PendingQueueCategory =
  | "guia_vencendo"
  | "guia_poucas_sessoes"
  | "cadastro_incompleto"
  | "evolucao_atrasada"
  | "documento_vencido"
  | "interessado_sem_retorno"
  | "falta_sem_motivo"
  | "remarcacao_solicitada"
  | "documento_familia_novo"
  | "renovacao_solicitada"
  | "cadastro_assistido_ia"
  | "chegada_nao_confirmada"
  // Fluxo de acolhimento (FASE 4, acolhimento_requests) — ver
  // lib/acolhimento-requests.ts e app/recepcao/acolhimentos.
  | "acolhimento_para_agendar"
  | "acolhimento_hoje"
  | "contrato_para_entregar"
  | "familia_para_informar"
  | "convenio_pendente_documentos"
  // Desligamento automático por faltas consecutivas (FASE 5, patients.
  // discharged_auto) — ver lib/absence-policy.ts e app/supervisao/desligamentos.
  | "desligamento_automatico";

export type PendingQueueItem = {
  id: string;
  category: PendingQueueCategory;
  categoryLabel: string;
  patientId: string | null;
  patientName: string;
  detail: string;
  urgencyLabel: string;
  href: string;
  /** Só preenchido em falta_sem_motivo — id do appointment pra ação de definir motivo/desfazer. */
  appointmentId?: string;
  /** Só preenchido em remarcacao_solicitada — id da reschedule_request pra ação de concluir. */
  rescheduleRequestId?: string;
  /** Só preenchido em documento_familia_novo — id do documento pra ação de marcar como revisado. */
  documentId?: string;
  /** Só preenchido em renovacao_solicitada — id da linha em
   * authorization_renewal_requests, pra ação de marcar como resolvida. */
  renewalRequestId?: string;
  /** Só preenchido em cadastro_assistido_ia — id do registration_drafts pra abrir a tela de validação. */
  draftId?: string;
  /** Só preenchido nas categorias de acolhimento — id da acolhimento_requests pra ação direta na tela do fluxo. */
  acolhimentoRequestId?: string;
  /**
   * Dono + prazo (pending_queue_assignments) — preenchido por
   * attachQueueAssignments logo abaixo, depois que todas as categorias já
   * empurraram seus itens em `items`. Opcionais aqui de propósito: cada
   * `items.push(...)` das categorias continua sem precisar declarar esses
   * 4 campos, então uma categoria nova adicionada em paralelo por outro
   * agente não quebra por esquecer deles.
   */
  assignedToId?: string | null;
  assignedToName?: string | null;
  dueAt?: string | null;
  escalatedAt?: string | null;
  /** dueAt no passado e ainda não resolvido — cálculo em JS (não depende do cron já ter rodado). */
  overdue?: boolean;
};

/**
 * Prazo padrão por categoria pra pending_queue_assignments (§9.1 "dono +
 * prazo"). Escolha documentada aqui por não existir constante de app
 * compartilhada entre SQL e TS pra isso (mesma situação de
 * ATTENDANCE_GRACE_MINUTES em auto_resolve_appointments):
 *  - interessado_sem_retorno: já é o item mais urgente da fila (só entra depois de
 *    15min sem retorno) — 1h de prazo pra não deixar o interessado esfriar.
 *  - falta_sem_motivo: precisa de contato com a família no mesmo dia — 24h.
 *  - cadastro_incompleto / evolucao_atrasada / remarcacao_solicitada /
 *    documento_familia_novo: mesma janela de 24h — itens que dependem de um
 *    retorno humano rápido, mas não são tão urgentes quanto um interessado novo.
 *  - guia_vencendo / guia_poucas_sessoes / documento_vencido /
 *    renovacao_solicitada: prazos administrativos que dependem de terceiros
 *    (convênio, família trazendo documento) — 3 dias de folga antes de
 *    escalar pro supervisor.
 *  - chegada_nao_confirmada: a família já está fisicamente na clínica (ver
 *    checkin_requests, 20260908040000) — mais urgente até que interessado
 *    sem retorno, porque tem gente esperando no balcão agora, não só um
 *    contato frio. 15min de prazo casa com o degrau de escalonamento do
 *    painel de chegadas (app/recepcao/chegadas).
 */
const DUE_MINUTES_BY_CATEGORY: Record<PendingQueueCategory, number> = {
  chegada_nao_confirmada: 15,
  interessado_sem_retorno: 60,
  falta_sem_motivo: 24 * 60,
  cadastro_incompleto: 24 * 60,
  evolucao_atrasada: 24 * 60,
  remarcacao_solicitada: 24 * 60,
  documento_familia_novo: 24 * 60,
  guia_vencendo: 3 * 24 * 60,
  guia_poucas_sessoes: 3 * 24 * 60,
  documento_vencido: 3 * 24 * 60,
  renovacao_solicitada: 3 * 24 * 60,
  cadastro_assistido_ia: 24 * 60,
  // Acolhimento (FASE 4): "hoje" segue a mesma urgência de chegada_nao_
  // confirmada (a família pode estar chegando no dia); as demais são
  // administrativas de até 24h/3 dias, no mesmo espírito das categorias
  // acima que dependem só de ação interna (recepção/gestor) vs. terceiro.
  acolhimento_para_agendar: 24 * 60,
  acolhimento_hoje: 60,
  contrato_para_entregar: 24 * 60,
  familia_para_informar: 24 * 60,
  convenio_pendente_documentos: 3 * 24 * 60,
  // Informacional (o desligamento em si já aconteceu sozinho no banco) —
  // janela generosa só pra recepção/supervisão tomarem ciência e decidirem
  // se reativam, sem pressão de prazo curto.
  desligamento_automatico: 24 * 60,
};

const CATEGORY_LABEL: Record<PendingQueueCategory, string> = {
  guia_vencendo: "Guia vencendo",
  guia_poucas_sessoes: "Guia com poucas sessões",
  cadastro_incompleto: "Cadastro incompleto",
  evolucao_atrasada: "Evolução pendente > 24h",
  documento_vencido: "Documento vencido",
  interessado_sem_retorno: "Interessado sem retorno > 15 min",
  falta_sem_motivo: "Falta sem motivo",
  remarcacao_solicitada: "Pedido de remarcação",
  documento_familia_novo: "Documento enviado pela família",
  renovacao_solicitada: "Renovação de guia solicitada",
  cadastro_assistido_ia: "Documentos para conferir (IA)",
  chegada_nao_confirmada: "Chegada aguardando confirmação",
  acolhimento_para_agendar: "Acolhimento para agendar",
  acolhimento_hoje: "Acolhimento com avaliação hoje",
  contrato_para_entregar: "Contrato para entregar",
  familia_para_informar: "Família para informar",
  convenio_pendente_documentos: "Acolhimento convênio — documentos pendentes",
  desligamento_automatico: "Desligamento automático",
};

export type ExpiringAuthorization = {
  patientId: string;
  patientName: string;
  insurerName: string;
  sessionsUsed: number;
  sessionsAuthorized: number;
  validTo: string;
  reason: "vencendo" | "poucas_sessoes";
};

/**
 * Autorizações ativas vencendo em 15 dias ou com ≤4 sessões restantes
 * (§9.3 do PRD). Auto-contida (busca patients/patient_insurance/authorizations
 * por conta própria) pra poder ser reusada tanto na home da recepção quanto
 * na fila completa, sem depender do que a página já tiver carregado.
 */
export async function getExpiringAuthorizations(supabase: Supa, clinicId: string): Promise<ExpiringAuthorization[]> {
  const today = civilDateInTimeZone(new Date(), CLINIC_TIMEZONE);
  const fifteenDaysStr = civilDateInTimeZone(new Date(Date.now() + 15 * 86_400_000), CLINIC_TIMEZONE);

  const { data: patients } = await supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId);
  const patientIds = (patients ?? []).map((p) => p.id);
  const patientNameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  if (patientIds.length === 0) return [];

  const { data: patientInsurances } = await supabase
    .from("patient_insurance")
    .select("id, patient_id, insurers(name)")
    .in("patient_id", patientIds);
  const insuranceById = new Map((patientInsurances ?? []).map((pi) => [pi.id, pi]));
  const insuranceIds = (patientInsurances ?? []).map((pi) => pi.id);
  if (insuranceIds.length === 0) return [];

  const { data: activeAuths } = await supabase
    .from("authorizations")
    .select("patient_insurance_id, sessions_used, sessions_authorized, valid_to")
    .in("patient_insurance_id", insuranceIds)
    .eq("status", "ativa");

  const result: ExpiringAuthorization[] = [];
  for (const auth of activeAuths ?? []) {
    const insurance = insuranceById.get(auth.patient_insurance_id);
    if (!insurance) continue;
    const insurerName =
      (Array.isArray(insurance.insurers) ? insurance.insurers[0]?.name : insurance.insurers?.name) ?? "Plano de Saúde";
    const sessionsRemaining = auth.sessions_authorized - auth.sessions_used;
    const expiringSoon = auth.valid_to >= today && auth.valid_to <= fifteenDaysStr;
    const fewSessionsLeft = sessionsRemaining <= 4;
    if (!expiringSoon && !fewSessionsLeft) continue;

    result.push({
      patientId: insurance.patient_id,
      patientName: patientNameById.get(insurance.patient_id) ?? "—",
      insurerName,
      sessionsUsed: auth.sessions_used,
      sessionsAuthorized: auth.sessions_authorized,
      validTo: auth.valid_to,
      reason: expiringSoon ? "vencendo" : "poucas_sessoes",
    });
  }
  return result;
}

export type AuthorizationWizardItem = {
  id: string;
  patientName: string;
  insurerName: string;
  specialty: string;
  authorizedHours: number;
  consumedHours: number;
  expiresAt: string;
  status: "regular" | "attention" | "critical";
  protocolNumber: string;
};

/**
 * Busca autorizações reais cadastradas no banco para exibir no assistente de pacotes TISS
 */
export async function getAuthorizationWizardItems(
  supabase: Supa,
  clinicId: string
): Promise<AuthorizationWizardItem[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, birth_date")
    .eq("clinic_id", clinicId);

  const patientIds = (patients ?? []).map((p) => p.id);
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));
  if (patientIds.length === 0) return [];

  const { data: patientInsurances } = await supabase
    .from("patient_insurance")
    .select("id, patient_id, insurers(name)")
    .in("patient_id", patientIds);

  const insuranceById = new Map((patientInsurances ?? []).map((pi) => [pi.id, pi]));
  const insuranceIds = (patientInsurances ?? []).map((pi) => pi.id);
  if (insuranceIds.length === 0) return [];

  const { data: auths } = await supabase
    .from("authorizations")
    .select("id, patient_insurance_id, guide_number, procedure_code, sessions_authorized, sessions_used, valid_to, status")
    .in("patient_insurance_id", insuranceIds)
    .in("status", ["ativa", "pendente"]);

  const items: AuthorizationWizardItem[] = [];
  for (const auth of auths ?? []) {
    const insurance = insuranceById.get(auth.patient_insurance_id);
    if (!insurance) continue;
    const patient = patientById.get(insurance.patient_id);
    const insurerName =
      (Array.isArray(insurance.insurers) ? insurance.insurers[0]?.name : insurance.insurers?.name) ?? "Plano de Saúde";

    let ageStr = "";
    if (patient?.birth_date) {
      const birth = new Date(patient.birth_date);
      const age = new Date().getFullYear() - birth.getFullYear();
      if (age >= 0 && age < 120) ageStr = ` (${age} anos)`;
    }

    const pct = auth.sessions_authorized > 0 ? Math.round((auth.sessions_used / auth.sessions_authorized) * 100) : 0;
    let itemStatus: "regular" | "attention" | "critical" = "regular";
    if (pct >= 90) {
      itemStatus = "critical";
    } else if (pct >= 70) {
      itemStatus = "attention";
    }

    items.push({
      id: auth.id,
      patientName: (patient?.full_name ?? "—") + ageStr,
      insurerName,
      specialty: auth.procedure_code || "Atendimento",
      authorizedHours: auth.sessions_authorized,
      consumedHours: auth.sessions_used,
      expiresAt: auth.valid_to,
      status: itemStatus,
      protocolNumber: auth.guide_number || `AUT-${auth.id.slice(0, 8)}`,
    });
  }

  return items.sort((a, b) => {
    const priority = { critical: 0, attention: 1, regular: 2 };
    return priority[a.status] - priority[b.status];
  });
}

export type ExpiredDocument = {
  patientId: string;
  patientName: string;
  categoryLabel: string;
  validUntil: string;
  daysExpired: number;
};

/** Documentos com validade vencida (§9.5), escopados por clínica via patients. */
async function getExpiredDocuments(supabase: Supa, clinicId: string): Promise<ExpiredDocument[]> {
  const today = civilDateInTimeZone(new Date(), CLINIC_TIMEZONE);

  const { data } = await supabase
    .from("documents")
    .select("category, valid_until, patients!inner(id, full_name, clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .not("valid_until", "is", null)
    .lt("valid_until", today);

  return (data ?? []).map((d) => {
    const patient = Array.isArray(d.patients) ? d.patients[0] : d.patients;
    const daysExpired = Math.floor(
      (new Date(`${today}T00:00:00`).getTime() - new Date(`${d.valid_until}T00:00:00`).getTime()) / 86_400_000,
    );
    return {
      patientId: patient?.id ?? "",
      patientName: patient?.full_name ?? "—",
      categoryLabel: d.category,
      validUntil: d.valid_until as string,
      daysExpired,
    };
  });
}

export type UnansweredInteressado = {
  patientId: string;
  patientName: string;
  minutesWaiting: number;
  createdAt: string;
};

/**
 * Interessados sem primeiro retorno humano há mais de 15 minutos (§9.1). Depende de
 * `patients.first_contact_at` só ser gravado quando alguém de fato retorna o
 * contato (ver `registerFirstContact` em app/recepcao/pacientes/actions.ts) —
 * nunca no momento do cadastro, senão esse alerta nunca dispara.
 */
async function getUnansweredInteressados(supabase: Supa, clinicId: string, minutesThreshold = 15): Promise<UnansweredInteressado[]> {
  const cutoff = new Date(Date.now() - minutesThreshold * 60_000).toISOString();

  const { data } = await supabase
    .from("patients")
    .select("id, full_name, created_at")
    .eq("clinic_id", clinicId)
    .eq("status", "interessado")
    .is("first_contact_at", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    patientId: p.id,
    patientName: p.full_name,
    minutesWaiting: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60_000),
    createdAt: p.created_at,
  }));
}

export type AutoFaltaPendingReason = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  startsAt: string;
  minutesAgo: number;
};

/**
 * Faltas marcadas pela rotina automática de baixa de presença
 * (auto_resolve_appointments, supabase/migrations/20260906000016_auto_
 * attendance_resolution.sql) que ainda não têm motivo — a rotina só sabe
 * dizer "não teve check-in", quem preenche o porquê é a recepção (ver
 * setAutoFaltaReason em app/recepcao/agenda/session-actions.ts).
 */
async function getAutoFaltasSemMotivo(supabase: Supa, clinicId: string): Promise<AutoFaltaPendingReason[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("appointments")
    .select("id, starts_at, patients!inner(id, full_name, clinic_id)")
    .eq("patients.clinic_id", clinicId)
    .eq("status", "falta_familia")
    .eq("auto_marked", true)
    .is("cancel_reason", null)
    .order("starts_at", { ascending: true });

  return ((data as any[]) ?? []).map((a: any) => {
    const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
    return {
      appointmentId: a.id,
      patientId: patient?.id ?? "",
      patientName: patient?.full_name ?? "—",
      startsAt: a.starts_at,
      minutesAgo: Math.floor((Date.now() - new Date(a.starts_at).getTime()) / 60_000),
    };
  });
}

export type PendingRescheduleRequest = {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  message: string;
  createdAt: string;
};

/**
 * Pedidos de remarcação da família ainda não resolvidos (PRD §3.4,
 * reschedule_requests, 20260906000019) — escopados por clínica via
 * appointments→patients (mesmo padrão de getAutoFaltasSemMotivo acima).
 */
async function getPendingRescheduleRequests(supabase: Supa, clinicId: string): Promise<PendingRescheduleRequest[]> {
  const { data } = await supabase
    .from("reschedule_requests")
    .select("id, appointment_id, message, created_at, appointments!inner(patient_id, patients!inner(id, full_name, clinic_id))")
    .eq("status", "em_analise")
    .eq("appointments.patients.clinic_id", clinicId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => {
    const appt = Array.isArray(r.appointments) ? r.appointments[0] : r.appointments;
    const patient = appt ? (Array.isArray(appt.patients) ? appt.patients[0] : appt.patients) : null;
    return {
      id: r.id,
      appointmentId: r.appointment_id,
      patientId: patient?.id ?? "",
      patientName: patient?.full_name ?? "—",
      message: r.message,
      createdAt: r.created_at,
    };
  });
}

export type PendingFamilyDocument = {
  id: string;
  patientId: string;
  patientName: string;
  note: string | null;
  uploadedAt: string;
};

/**
 * Documentos enviados pela família (PRD §3.6, category='familia_envio',
 * 20260906000020) ainda não conferidos pela recepção (reviewed_at is null).
 */
async function getPendingFamilyDocuments(supabase: Supa, clinicId: string): Promise<PendingFamilyDocument[]> {
  const { data } = await supabase
    .from("documents")
    .select("id, note, uploaded_at, patients!inner(id, full_name, clinic_id)")
    .eq("category", "familia_envio")
    .eq("patients.clinic_id", clinicId)
    .is("reviewed_at", null)
    .order("uploaded_at", { ascending: true });

  return (data ?? []).map((d) => {
    const patient = Array.isArray(d.patients) ? d.patients[0] : d.patients;
    return {
      id: d.id,
      patientId: patient?.id ?? "",
      patientName: patient?.full_name ?? "—",
      note: d.note,
      uploadedAt: d.uploaded_at,
    };
  });
}

export type AuthorizationRenewalRequest = {
  id: string;
  patientId: string;
  patientName: string;
  insurerName: string;
  status: "pendente" | "solicitada_convenio";
  createdAt: string;
};

/**
 * Solicitações de renovação já abertas automaticamente (tabela
 * `authorization_renewal_requests`, ver supabase/migrations/20260906000017_
 * authorization_renewal_requests.sql) pela rotina diária
 * `refresh_authorization_renewal_requests` — a mesma condição de vencimento
 * ≤15 dias / ≤4 sessões restantes que `getExpiringAuthorizations` já mostra
 * como aviso, só que aqui a solicitação (e o aviso à família) já foi
 * disparada; falta só a recepção cadastrar a nova guia na AutorizacaoWizard
 * e marcar como resolvida (ver authorization-renewal-actions.ts nesta pasta).
 */
async function getAuthorizationRenewalRequests(supabase: Supa, clinicId: string): Promise<AuthorizationRenewalRequest[]> {
  const { data } = await supabase
    .from("authorization_renewal_requests")
    .select(
      "id, status, created_at, patient_insurance:patient_insurance_id(patient_id, insurers(name), patients(id, full_name, clinic_id))",
    )
    .in("status", ["pendente", "solicitada_convenio"])
    .order("created_at", { ascending: true });

  const result: AuthorizationRenewalRequest[] = [];
  for (const r of data ?? []) {
    const pi = Array.isArray(r.patient_insurance) ? r.patient_insurance[0] : r.patient_insurance;
    if (!pi) continue;
    const patient = Array.isArray(pi.patients) ? pi.patients[0] : pi.patients;
    if (!patient || patient.clinic_id !== clinicId) continue;
    const insurerName = (Array.isArray(pi.insurers) ? pi.insurers[0]?.name : pi.insurers?.name) ?? "Plano de Saúde";

    result.push({
      id: r.id,
      patientId: patient.id,
      patientName: patient.full_name,
      insurerName,
      status: r.status as "pendente" | "solicitada_convenio",
      createdAt: r.created_at,
    });
  }
  return result;
}

export type PendingRegistrationDraft = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  sourcePhone: string | null;
  status: "extracted" | "failed";
  createdAt: string;
};

/**
 * Rascunhos do "cadastro assistido por IA" (registration_drafts,
 * 20260907000001) já extraídos (ou com falha de extração) esperando a
 * recepção conferir/confirmar. 'pending'/'processing' ficam de fora — ainda
 * não há nada pra humano revisar enquanto a IA está lendo.
 */
async function getPendingRegistrationDrafts(supabase: Supa, clinicId: string): Promise<PendingRegistrationDraft[]> {
  const { data } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, source_phone, status, created_at, patients(full_name)")
    .eq("clinic_id", clinicId)
    .in("status", ["extracted", "failed"])
    .order("created_at", { ascending: true });

  return (data ?? []).map((d) => {
    const patient = Array.isArray(d.patients) ? d.patients[0] : d.patients;
    return {
      id: d.id,
      patientId: d.patient_id,
      patientName: patient?.full_name ?? null,
      sourcePhone: d.source_phone,
      status: d.status as "extracted" | "failed",
      createdAt: d.created_at,
    };
  });
}

export type UnconfirmedCheckin = {
  id: string;
  patientId: string | null;
  patientName: string;
  ticketLabel: string;
  createdAt: string;
  minutesWaiting: number;
};

/**
 * Chegadas declaradas pelo QR da entrada (checkin_requests, 20260908040000)
 * ainda não confirmadas pela recepção, com mais de MIN_MINUTES_WAITING de
 * espera — abaixo disso a recepção ainda tem tempo de reagir ao som/badge do
 * painel de chegadas sem precisar entrar na fila unificada de pendências.
 * Escopada por `clinic_id` diretamente (e não via patients, como as demais
 * categorias): a linha de "visitante sem agendamento" não tem patient_id.
 */
async function getUnconfirmedCheckins(supabase: Supa, clinicId: string, minMinutesWaiting = 10): Promise<UnconfirmedCheckin[]> {
  const cutoff = new Date(Date.now() - minMinutesWaiting * 60_000).toISOString();

  const { data } = await supabase
    .from("checkin_requests")
    .select("id, ticket_label, created_at, patient_id, declared_first_name, patients(full_name)")
    .eq("clinic_id", clinicId)
    .eq("status", "aguardando")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.full_name ?? r.declared_first_name,
      ticketLabel: r.ticket_label,
      createdAt: r.created_at,
      minutesWaiting: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60_000),
    };
  });
}

export type AcolhimentoQueueRow = {
  id: string;
  patientId: string;
  patientName: string;
  funding: string;
  status: string;
  appointmentId: string | null;
  appointmentStartsAt: string | null;
  createdAt: string;
  missingReason: "PEDIDO_MEDICO_AUSENTE" | "GUIA_NAO_VALIDADA" | null;
};

/**
 * Acolhimentos (FASE 4, acolhimento_requests) relevantes pra fila única da
 * recepção — busca tudo de uma vez (não-concluído/cancelado) e cada
 * categoria abaixo filtra por status/condição, evitando 1 query por
 * categoria. `missingReason` reproduz em TS a mesma checagem da função SQL
 * `acolhimento_can_schedule` (pedido_medico em documents + authorizations
 * status='ativa') pra `convenio_pendente_documentos` — mesma regra, sem
 * round-trip extra de RPC por linha.
 */
async function getAcolhimentoQueueRows(supabase: Supa, clinicId: string): Promise<AcolhimentoQueueRow[]> {
  const { data } = await supabase
    .from("acolhimento_requests")
    .select(
      "id, patient_id, funding, status, appointment_id, created_at, patients(full_name), appointments(starts_at)",
    )
    .eq("clinic_id", clinicId)
    .not("status", "in", "(concluido,cancelado)")
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  const convenioPatientIds = rows.filter((r) => r.funding === "convenio").map((r) => r.patient_id);

  const [{ data: referralDocs }, { data: patientInsurances }] = await Promise.all([
    convenioPatientIds.length
      ? supabase.from("documents").select("patient_id").eq("category", "pedido_medico").in("patient_id", convenioPatientIds)
      : Promise.resolve({ data: [] as { patient_id: string }[] }),
    convenioPatientIds.length
      ? supabase.from("patient_insurance").select("id, patient_id").in("patient_id", convenioPatientIds)
      : Promise.resolve({ data: [] as { id: string; patient_id: string }[] }),
  ]);

  const patientsWithReferral = new Set((referralDocs ?? []).map((d) => d.patient_id));
  const insuranceIdsByPatient = new Map<string, string[]>();
  for (const pi of patientInsurances ?? []) {
    const list = insuranceIdsByPatient.get(pi.patient_id) ?? [];
    list.push(pi.id);
    insuranceIdsByPatient.set(pi.patient_id, list);
  }

  const allInsuranceIds = (patientInsurances ?? []).map((pi) => pi.id);
  const { data: activeAuths } = allInsuranceIds.length
    ? await supabase.from("authorizations").select("patient_insurance_id").in("patient_insurance_id", allInsuranceIds).eq("status", "ativa")
    : { data: [] as { patient_insurance_id: string }[] };
  const insuranceIdsWithActiveAuth = new Set((activeAuths ?? []).map((a) => a.patient_insurance_id));

  function missingReasonFor(patientId: string): AcolhimentoQueueRow["missingReason"] {
    if (!patientsWithReferral.has(patientId)) return "PEDIDO_MEDICO_AUSENTE";
    const insuranceIds = insuranceIdsByPatient.get(patientId) ?? [];
    const hasActiveAuth = insuranceIds.some((id) => insuranceIdsWithActiveAuth.has(id));
    if (!hasActiveAuth) return "GUIA_NAO_VALIDADA";
    return null;
  }

  return rows.map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const appointment = Array.isArray(r.appointments) ? r.appointments[0] : r.appointments;
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.full_name ?? "—",
      funding: r.funding,
      status: r.status,
      appointmentId: r.appointment_id,
      appointmentStartsAt: appointment?.starts_at ?? null,
      createdAt: r.created_at,
      missingReason: r.funding === "convenio" ? missingReasonFor(r.patient_id) : null,
    };
  });
}

export type AutoDischargedPatient = {
  patientId: string;
  patientName: string;
  dischargedAt: string;
  reason: string | null;
};

/**
 * Pacientes desligados automaticamente por 2 faltas consecutivas sem
 * justificativa aprovada (FASE 5, `patients.discharged_auto`) — sem flag
 * própria de "revisado", então a categoria simplesmente lista todo mundo
 * ainda com `discharged_auto=true` (reativar limpa a flag e tira o item da
 * fila). Ver apply_auto_discharge/reactivate_discharged_patient em
 * supabase/migrations/20260917170500_auto_discharge_consecutive_faltas.sql.
 */
async function getAutoDischargedPatients(supabase: Supa, clinicId: string): Promise<AutoDischargedPatient[]> {
  const { data } = await supabase
    .from("patients")
    .select("id, full_name, discharged_at, discharge_reason")
    .eq("clinic_id", clinicId)
    .eq("discharged_auto", true)
    .order("discharged_at", { ascending: false });

  return (data ?? []).map((p) => ({
    patientId: p.id,
    patientName: p.full_name,
    dischargedAt: p.discharged_at ?? new Date().toISOString(),
    reason: p.discharge_reason,
  }));
}

/**
 * Dá dono + prazo a cada item da fila (pending_queue_assignments, §9.1):
 * qualquer item sem assignment ganha um agora (assigned_to = plantonista
 * padrão, due_at = agora + DUE_MINUTES_BY_CATEGORY[categoria]); itens que já
 * têm assignment só carregam o que já existe. Roda a cada carregamento da
 * fila (mesmo desenho "calculada on-demand" do resto do arquivo) — o
 * `unique (clinic_id, item_id)` da tabela garante que chamadas concorrentes
 * não dupliquem assignment pro mesmo item.
 *
 * Muta e devolve os próprios itens (evita recriar os objetos e perder
 * qualquer campo extra que outra categoria tenha colocado neles).
 */
/**
 * Cria o assignment padrão (dono + prazo) dos itens da fila que ainda não
 * têm um — chamada via after() por attachQueueAssignments, fora do caminho
 * de resposta da página.
 */
async function insertMissingAssignments(
  supabase: Supa,
  clinicId: string,
  missing: PendingQueueItem[],
): Promise<void> {
  // Regra de "plantão" documentada (§9.1 da tarefa): o sistema não tem
  // conceito de escala/plantão hoje, então o dono padrão de um item recém
  // detectado é, deterministicamente, o profile ativo mais antigo com
  // role='recepcao' — evita sortear um dono diferente a cada carregamento
  // de página enquanto ninguém reatribui manualmente.
  const { data: onDuty } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "recepcao")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const inserts = missing.map((item) => ({
    clinic_id: clinicId,
    item_id: item.id,
    category: item.category,
    patient_id: item.patientId,
    assigned_to: onDuty?.id ?? null,
    due_at: new Date(now + DUE_MINUTES_BY_CATEGORY[item.category] * 60_000).toISOString(),
  }));

  // onConflict com ignoreDuplicates: se outra requisição concorrente já
  // inseriu o mesmo item_id entre a leitura em attachQueueAssignments e este
  // insert, este upsert não sobrescreve o assignment que já existe (não
  // queremos "resetar" due_at/assigned_to de um item que já tinha dono).
  await supabase
    .from("pending_queue_assignments")
    .upsert(inserts, { onConflict: "clinic_id,item_id", ignoreDuplicates: true });
}

async function attachQueueAssignments(
  supabase: Supa,
  clinicId: string,
  items: PendingQueueItem[],
): Promise<PendingQueueItem[]> {
  if (items.length === 0) return items;

  const { data: existing } = await supabase
    .from("pending_queue_assignments")
    .select("item_id, assigned_to, due_at, escalated_at, resolved_at, profiles(full_name)")
    .eq("clinic_id", clinicId)
    .in(
      "item_id",
      items.map((i) => i.id),
    );

  const existingByItemId = new Map((existing ?? []).map((row) => [row.item_id, row]));
  const missing = items.filter((item) => !existingByItemId.has(item.id));

  if (missing.length > 0) {
    // O upsert (e a leitura de "quem está de plantão" que ele precisa) é uma
    // ESCRITA no caminho de leitura desta página — antes rodava aqui, síncrono,
    // em toda /recepcao. Adiada com after() (Next 16): a resposta não espera
    // por ela. O comportamento no render atual é o mesmo que o comentário
    // abaixo já descrevia para a corrida concorrente — item novo aparece sem
    // dono/prazo agora, e resolvido no próximo carregamento da página, que já
    // é o padrão tolerado aqui.
    after(() => insertMissingAssignments(supabase, clinicId, missing));
  }

  const nowIso = new Date().toISOString();
  for (const item of items) {
    const row = existingByItemId.get(item.id);
    if (!row) continue;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    item.assignedToId = row.assigned_to;
    item.assignedToName = profile?.full_name ?? null;
    item.dueAt = row.due_at;
    item.escalatedAt = row.escalated_at;
    item.overdue = !row.resolved_at && row.due_at < nowIso;
  }

  return items;
}

/**
 * Fila única de pendências da recepção (§9.1), ordenada por urgência —
 * agrega as 6 categorias que o PRD descreve pra home da recepção. Cada
 * categoria já tem sua função/regra de negócio própria e testada em outro
 * lugar do app (guia vencendo, cadastro incompleto, evolução atrasada); esta
 * função só junta e ordena pra exibição, sem duplicar regra.
 */
export async function getReceptionQueue(supabase: Supa, clinicId: string = DEV_CLINIC_ID): Promise<PendingQueueItem[]> {
  const [
    expiringAuths,
    pendingPatients,
    overdueNotes,
    expiredDocuments,
    unansweredInteressados,
    autoFaltas,
    rescheduleRequests,
    pendingFamilyDocuments,
    renewalRequests,
    pendingRegistrationDrafts,
    unconfirmedCheckins,
    acolhimentoRows,
    autoDischargedPatients,
  ] = await Promise.all([
    getExpiringAuthorizations(supabase, clinicId),
    getPendingPatients(supabase, 3),
    listOverdueSessionNotes(supabase),
    getExpiredDocuments(supabase, clinicId),
    getUnansweredInteressados(supabase, clinicId),
    getAutoFaltasSemMotivo(supabase, clinicId),
    getPendingRescheduleRequests(supabase, clinicId),
    getPendingFamilyDocuments(supabase, clinicId),
    getAuthorizationRenewalRequests(supabase, clinicId),
    getPendingRegistrationDrafts(supabase, clinicId),
    getUnconfirmedCheckins(supabase, clinicId),
    getAcolhimentoQueueRows(supabase, clinicId),
    getAutoDischargedPatients(supabase, clinicId),
  ]);

  const items: PendingQueueItem[] = [];

  for (const g of expiringAuths.filter((a) => a.reason === "vencendo").sort((a, b) => a.validTo.localeCompare(b.validTo))) {
    items.push({
      id: `guia-vence-${g.patientId}-${g.validTo}`,
      category: "guia_vencendo",
      categoryLabel: CATEGORY_LABEL.guia_vencendo,
      patientId: g.patientId,
      patientName: g.patientName,
      detail: `${g.insurerName} · vence em ${new Date(`${g.validTo}T00:00:00`).toLocaleDateString("pt-BR")}`,
      urgencyLabel: g.validTo,
      href: `/recepcao/pacientes/${g.patientId}`,
    });
  }

  for (const g of expiringAuths
    .filter((a) => a.reason === "poucas_sessoes")
    .sort((a, b) => a.sessionsAuthorized - a.sessionsUsed - (b.sessionsAuthorized - b.sessionsUsed))) {
    items.push({
      id: `guia-poucas-${g.patientId}-${g.validTo}`,
      category: "guia_poucas_sessoes",
      categoryLabel: CATEGORY_LABEL.guia_poucas_sessoes,
      patientId: g.patientId,
      patientName: g.patientName,
      detail: `${g.insurerName} · ${g.sessionsUsed} de ${g.sessionsAuthorized} sessões usadas`,
      urgencyLabel: `${g.sessionsAuthorized - g.sessionsUsed} restantes`,
      href: `/recepcao/pacientes/${g.patientId}`,
    });
  }

  for (const p of pendingPatients) {
    items.push({
      id: `cadastro-${p.id}`,
      category: "cadastro_incompleto",
      categoryLabel: CATEGORY_LABEL.cadastro_incompleto,
      patientId: p.id,
      patientName: p.full_name,
      detail: `Parado há ${p.daysSinceCreated} dia(s)`,
      urgencyLabel: `${p.daysSinceCreated}d`,
      href: `/recepcao/pacientes/${p.id}`,
    });
  }

  for (const n of overdueNotes) {
    items.push({
      id: `evolucao-${n.appointmentId}`,
      category: "evolucao_atrasada",
      categoryLabel: CATEGORY_LABEL.evolucao_atrasada,
      patientId: null,
      patientName: n.patientName,
      detail: `${n.therapistName} · sessão de ${new Date(n.startsAt).toLocaleDateString("pt-BR")}`,
      urgencyLabel: `${n.hoursOverdue}h atrasada`,
      href: `/recepcao`,
    });
  }

  for (const d of expiredDocuments.sort((a, b) => b.daysExpired - a.daysExpired)) {
    items.push({
      id: `documento-${d.patientId}-${d.categoryLabel}-${d.validUntil}`,
      category: "documento_vencido",
      categoryLabel: CATEGORY_LABEL.documento_vencido,
      patientId: d.patientId,
      patientName: d.patientName,
      detail: `${d.categoryLabel} · venceu em ${new Date(`${d.validUntil}T00:00:00`).toLocaleDateString("pt-BR")}`,
      urgencyLabel: `${d.daysExpired}d vencido`,
      href: `/recepcao/pacientes/${d.patientId}`,
    });
  }

  for (const l of unansweredInteressados) {
    items.push({
      id: `interessado-${l.patientId}`,
      category: "interessado_sem_retorno",
      categoryLabel: CATEGORY_LABEL.interessado_sem_retorno,
      patientId: l.patientId,
      patientName: l.patientName,
      detail: `Cadastrado há ${l.minutesWaiting} min sem retorno`,
      urgencyLabel: `${l.minutesWaiting}min`,
      href: `/recepcao/pacientes/${l.patientId}`,
    });
  }

  for (const f of autoFaltas.sort((a, b) => b.minutesAgo - a.minutesAgo)) {
    items.push({
      id: `falta-auto-${f.appointmentId}`,
      category: "falta_sem_motivo",
      categoryLabel: CATEGORY_LABEL.falta_sem_motivo,
      patientId: f.patientId,
      patientName: f.patientName,
      detail: `Sessão de ${new Date(f.startsAt).toLocaleString("pt-BR")} sem check-in`,
      urgencyLabel: `${f.minutesAgo}min`,
      href: `/recepcao/pacientes/${f.patientId}`,
      appointmentId: f.appointmentId,
    });
  }

  for (const r of rescheduleRequests) {
    items.push({
      id: `remarcacao-${r.id}`,
      category: "remarcacao_solicitada",
      categoryLabel: CATEGORY_LABEL.remarcacao_solicitada,
      patientId: r.patientId,
      patientName: r.patientName,
      detail: r.message,
      urgencyLabel: new Date(r.createdAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${r.patientId}`,
      rescheduleRequestId: r.id,
    });
  }

  for (const d of pendingFamilyDocuments) {
    items.push({
      id: `doc-familia-${d.id}`,
      category: "documento_familia_novo",
      categoryLabel: CATEGORY_LABEL.documento_familia_novo,
      patientId: d.patientId,
      patientName: d.patientName,
      detail: d.note || "Documento enviado pelo portal da família",
      urgencyLabel: new Date(d.uploadedAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${d.patientId}`,
      documentId: d.id,
    });
  }

  for (const r of renewalRequests) {
    items.push({
      id: `renovacao-${r.id}`,
      category: "renovacao_solicitada",
      categoryLabel: CATEGORY_LABEL.renovacao_solicitada,
      patientId: r.patientId,
      patientName: r.patientName,
      detail: `${r.insurerName} · ${r.status === "solicitada_convenio" ? "solicitada ao plano de saúde" : "aguardando início"}`,
      urgencyLabel: new Date(r.createdAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${r.patientId}`,
      renewalRequestId: r.id,
    });
  }

  for (const d of pendingRegistrationDrafts) {
    items.push({
      id: `cadastro-ia-${d.id}`,
      category: "cadastro_assistido_ia",
      categoryLabel: CATEGORY_LABEL.cadastro_assistido_ia,
      patientId: d.patientId,
      patientName: d.patientName ?? `Pré-cadastro · ${d.sourcePhone ?? "número novo"}`,
      detail: d.status === "failed" ? "Extração falhou — reprocessar ou preencher manualmente" : "Pronto para conferir",
      urgencyLabel: new Date(d.createdAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pre-cadastros/${d.id}`,
      draftId: d.id,
    });
  }

  for (const c of unconfirmedCheckins.sort((a, b) => b.minutesWaiting - a.minutesWaiting)) {
    items.push({
      id: `chegada-${c.id}`,
      category: "chegada_nao_confirmada",
      categoryLabel: CATEGORY_LABEL.chegada_nao_confirmada,
      patientId: c.patientId,
      patientName: c.patientName,
      detail: `Senha ${c.ticketLabel} · aguardando na recepção`,
      urgencyLabel: `${c.minutesWaiting}min`,
      href: `/recepcao/chegadas`,
    });
  }

  const today = civilDateInTimeZone(new Date(), CLINIC_TIMEZONE);

  for (const a of acolhimentoRows.filter((r) => r.status === "aguardando_agendamento")) {
    items.push({
      id: `acolhimento-agendar-${a.id}`,
      category: "acolhimento_para_agendar",
      categoryLabel: CATEGORY_LABEL.acolhimento_para_agendar,
      patientId: a.patientId,
      patientName: a.patientName,
      detail: `${a.funding === "particular" ? "Particular" : "Convênio"} · aguardando agendamento da 1ª avaliação`,
      urgencyLabel: new Date(a.createdAt).toLocaleDateString("pt-BR"),
      href: "/recepcao/acolhimentos",
      acolhimentoRequestId: a.id,
    });
  }

  for (const a of acolhimentoRows.filter(
    (r) => r.appointmentId && r.appointmentStartsAt && r.status !== "realizado" && civilDateInTimeZone(new Date(r.appointmentStartsAt), CLINIC_TIMEZONE) === today,
  )) {
    items.push({
      id: `acolhimento-hoje-${a.id}`,
      category: "acolhimento_hoje",
      categoryLabel: CATEGORY_LABEL.acolhimento_hoje,
      patientId: a.patientId,
      patientName: a.patientName,
      detail: `1ª avaliação hoje às ${new Date(a.appointmentStartsAt as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIMEZONE })}`,
      urgencyLabel: "Hoje",
      href: "/recepcao/acolhimentos",
      acolhimentoRequestId: a.id,
      appointmentId: a.appointmentId ?? undefined,
    });
  }

  for (const a of acolhimentoRows.filter((r) => r.status === "realizado")) {
    items.push({
      id: `acolhimento-contrato-${a.id}`,
      category: "contrato_para_entregar",
      categoryLabel: CATEGORY_LABEL.contrato_para_entregar,
      patientId: a.patientId,
      patientName: a.patientName,
      detail: "1ª avaliação realizada · falta entregar o contrato",
      urgencyLabel: new Date(a.createdAt).toLocaleDateString("pt-BR"),
      href: "/recepcao/acolhimentos",
      acolhimentoRequestId: a.id,
    });
  }

  // familia_para_informar cobre contrato_pendente e grade_pendente: em
  // ambos os casos a recepção ainda vai precisar avisar a família (do
  // contrato entregue, ou já da grade fixa depois que a Supervisão definir)
  // — mais correto agrupar os dois do que só um, senão o item "sai" da fila
  // assim que o contrato é entregue mesmo sem a família ter sido avisada.
  for (const a of acolhimentoRows.filter((r) => r.status === "contrato_pendente" || r.status === "grade_pendente")) {
    items.push({
      id: `acolhimento-familia-${a.id}`,
      category: "familia_para_informar",
      categoryLabel: CATEGORY_LABEL.familia_para_informar,
      patientId: a.patientId,
      patientName: a.patientName,
      detail: a.status === "grade_pendente" ? "Aguardando Supervisão definir a grade fixa" : "Contrato entregue · falta informar a família",
      urgencyLabel: new Date(a.createdAt).toLocaleDateString("pt-BR"),
      href: "/recepcao/acolhimentos",
      acolhimentoRequestId: a.id,
    });
  }

  for (const a of acolhimentoRows.filter((r) => r.funding === "convenio" && r.missingReason && r.status !== "agendado")) {
    items.push({
      id: `acolhimento-docs-${a.id}`,
      category: "convenio_pendente_documentos",
      categoryLabel: CATEGORY_LABEL.convenio_pendente_documentos,
      patientId: a.patientId,
      patientName: a.patientName,
      detail: a.missingReason === "PEDIDO_MEDICO_AUSENTE" ? "Falta o pedido médico (documents)" : "Falta validar a guia (authorizations)",
      urgencyLabel: new Date(a.createdAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${a.patientId}`,
      acolhimentoRequestId: a.id,
    });
  }

  for (const d of autoDischargedPatients) {
    items.push({
      id: `desligamento-${d.patientId}`,
      category: "desligamento_automatico",
      categoryLabel: CATEGORY_LABEL.desligamento_automatico,
      patientId: d.patientId,
      patientName: d.patientName,
      detail: d.reason ? `Desligado automaticamente · ${d.reason}` : "Desligado automaticamente por 2 faltas consecutivas",
      urgencyLabel: new Date(d.dischargedAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${d.patientId}/gestao`,
    });
  }

  return attachQueueAssignments(supabase, clinicId, items);
}

/**
 * Variante cacheada por request de `getReceptionQueue`, usando o cliente
 * padrão (`lib/supabase/server.ts`). Existe porque `app/recepcao/layout.tsx`
 * (badge do menu) e `app/recepcao/page.tsx` / `app/recepcao/pacientes/pendencias/page.tsx`
 * (lista completa) chamavam `getReceptionQueue` cada um por conta própria no
 * MESMO render — ~17 queries em fan-out, duas vezes, ~34 no total. Com
 * `cache()`, o segundo chamador reusa o resultado do primeiro.
 *
 * Call sites que já têm um cliente Supabase em mãos (ex.: cron/service-role)
 * continuam usando `getReceptionQueue(supabase, clinicId)` diretamente — esta
 * variante é só para o caminho de render autenticado por cookie.
 */
export const getCachedReceptionQueue = cache(async (clinicId: string = DEV_CLINIC_ID) => {
  const supabase = await createClient();
  return getReceptionQueue(supabase, clinicId);
});
