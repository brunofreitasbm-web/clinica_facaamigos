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
  | "lead_sem_retorno";

export type PendingQueueItem = {
  id: string;
  category: PendingQueueCategory;
  categoryLabel: string;
  patientId: string | null;
  patientName: string;
  detail: string;
  urgencyLabel: string;
  href: string;
};

const CATEGORY_LABEL: Record<PendingQueueCategory, string> = {
  guia_vencendo: "Guia vencendo",
  guia_poucas_sessoes: "Guia com poucas sessões",
  cadastro_incompleto: "Cadastro incompleto",
  evolucao_atrasada: "Evolução pendente > 24h",
  documento_vencido: "Documento vencido",
  lead_sem_retorno: "Lead sem retorno > 15 min",
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

/**
 * Fila única de pendências da recepção (§9.1), ordenada por urgência —
 * agrega as 6 categorias que o PRD descreve pra home da recepção. Cada
 * categoria já tem sua função/regra de negócio própria e testada em outro
 * lugar do app (guia vencendo, cadastro incompleto, evolução atrasada); esta
 * função só junta e ordena pra exibição, sem duplicar regra.
 */
export async function getReceptionQueue(supabase: Supa, clinicId: string = DEV_CLINIC_ID): Promise<PendingQueueItem[]> {
  const [expiringAuths, pendingPatients, overdueNotes, expiredDocuments, unansweredLeads] = await Promise.all([
    getExpiringAuthorizations(supabase, clinicId),
    getPendingPatients(supabase, 3),
    listOverdueSessionNotes(supabase),
    getExpiredDocuments(supabase, clinicId),
    getUnansweredLeads(supabase, clinicId),
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

  return items;
}
