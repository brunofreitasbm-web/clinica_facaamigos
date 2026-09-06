import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone } from "@/lib/timezone";
import { getPendingPatients } from "@/lib/patient-stage";
import { listOverdueSessionNotes } from "@/lib/session-note-pending";

type Supa = SupabaseClient<Database>;

export type PendingQueueCategory =
  | "guia_vencendo"
  | "guia_poucas_sessoes"
  | "cadastro_incompleto"
  | "evolucao_atrasada"
  | "documento_vencido"
  | "lead_sem_retorno"
  | "falta_sem_motivo"
  | "remarcacao_solicitada"
  | "documento_familia_novo"
  | "renovacao_solicitada";

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
 *  - lead_sem_retorno: já é o item mais urgente da fila (só entra depois de
 *    15min sem retorno) — 1h de prazo pra não deixar o lead esfriar.
 *  - falta_sem_motivo: precisa de contato com a família no mesmo dia — 24h.
 *  - cadastro_incompleto / evolucao_atrasada / remarcacao_solicitada /
 *    documento_familia_novo: mesma janela de 24h — itens que dependem de um
 *    retorno humano rápido, mas não são tão urgentes quanto um lead novo.
 *  - guia_vencendo / guia_poucas_sessoes / documento_vencido /
 *    renovacao_solicitada: prazos administrativos que dependem de terceiros
 *    (convênio, família trazendo documento) — 3 dias de folga antes de
 *    escalar pro supervisor.
 */
const DUE_MINUTES_BY_CATEGORY: Record<PendingQueueCategory, number> = {
  lead_sem_retorno: 60,
  falta_sem_motivo: 24 * 60,
  cadastro_incompleto: 24 * 60,
  evolucao_atrasada: 24 * 60,
  remarcacao_solicitada: 24 * 60,
  documento_familia_novo: 24 * 60,
  guia_vencendo: 3 * 24 * 60,
  guia_poucas_sessoes: 3 * 24 * 60,
  documento_vencido: 3 * 24 * 60,
  renovacao_solicitada: 3 * 24 * 60,
};

const CATEGORY_LABEL: Record<PendingQueueCategory, string> = {
  guia_vencendo: "Guia vencendo",
  guia_poucas_sessoes: "Guia com poucas sessões",
  cadastro_incompleto: "Cadastro incompleto",
  evolucao_atrasada: "Evolução pendente > 24h",
  documento_vencido: "Documento vencido",
  lead_sem_retorno: "Lead sem retorno > 15 min",
  falta_sem_motivo: "Falta sem motivo",
  remarcacao_solicitada: "Pedido de remarcação",
  documento_familia_novo: "Documento enviado pela família",
  renovacao_solicitada: "Renovação de guia solicitada",
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
      (Array.isArray(insurance.insurers) ? insurance.insurers[0]?.name : insurance.insurers?.name) ?? "Convênio";
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

export type UnansweredLead = {
  patientId: string;
  patientName: string;
  minutesWaiting: number;
  createdAt: string;
};

/**
 * Leads sem primeiro retorno humano há mais de 15 minutos (§9.1). Depende de
 * `patients.first_contact_at` só ser gravado quando alguém de fato retorna o
 * contato (ver `registerFirstContact` em app/recepcao/pacientes/actions.ts) —
 * nunca no momento do cadastro, senão esse alerta nunca dispara.
 */
async function getUnansweredLeads(supabase: Supa, clinicId: string, minutesThreshold = 15): Promise<UnansweredLead[]> {
  const cutoff = new Date(Date.now() - minutesThreshold * 60_000).toISOString();

  const { data } = await supabase
    .from("patients")
    .select("id, full_name, created_at")
    .eq("clinic_id", clinicId)
    .eq("status", "lead")
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
    const insurerName = (Array.isArray(pi.insurers) ? pi.insurers[0]?.name : pi.insurers?.name) ?? "Convênio";

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
    // inseriu o mesmo item_id entre a leitura acima e este insert, este
    // upsert não sobrescreve o assignment que já existe (não queremos
    // "resetar" due_at/assigned_to de um item que já tinha dono).
    const { data: inserted } = await supabase
      .from("pending_queue_assignments")
      .upsert(inserts, { onConflict: "clinic_id,item_id", ignoreDuplicates: true })
      .select("item_id, assigned_to, due_at, escalated_at, resolved_at, profiles(full_name)");

    for (const row of inserted ?? []) {
      existingByItemId.set(row.item_id, row);
    }
    // Se o upsert ignorou por já existir (corrida concorrente), o item ainda
    // não está em existingByItemId — os campos ficam null abaixo, o que é
    // seguro (próximo carregamento da página resolve).
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
    unansweredLeads,
    autoFaltas,
    rescheduleRequests,
    pendingFamilyDocuments,
    renewalRequests,
  ] = await Promise.all([
    getExpiringAuthorizations(supabase, clinicId),
    getPendingPatients(supabase, 3),
    listOverdueSessionNotes(supabase),
    getExpiredDocuments(supabase, clinicId),
    getUnansweredLeads(supabase, clinicId),
    getAutoFaltasSemMotivo(supabase, clinicId),
    getPendingRescheduleRequests(supabase, clinicId),
    getPendingFamilyDocuments(supabase, clinicId),
    getAuthorizationRenewalRequests(supabase, clinicId),
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

  for (const l of unansweredLeads) {
    items.push({
      id: `lead-${l.patientId}`,
      category: "lead_sem_retorno",
      categoryLabel: CATEGORY_LABEL.lead_sem_retorno,
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
      detail: `${r.insurerName} · ${r.status === "solicitada_convenio" ? "solicitada ao convênio" : "aguardando início"}`,
      urgencyLabel: new Date(r.createdAt).toLocaleDateString("pt-BR"),
      href: `/recepcao/pacientes/${r.patientId}`,
      renewalRequestId: r.id,
    });
  }

  return attachQueueAssignments(supabase, clinicId, items);
}
