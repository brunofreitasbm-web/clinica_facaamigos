// lib/acolhimento-requests.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

// Duplicado literalmente de lib/constants.ts::DEV_CLINIC_ID (não importado
// por valor) — este arquivo é exercitado direto por
// tests/acolhimento-status.test.ts via `node --experimental-strip-types
// --test`, que não resolve o alias "@/..." em tempo de execução (só os
// `import type` acima são apagados na hora da checagem de tipos, o que é
// seguro). Mesmo padrão de todo lib/*.ts com teste unitário no projeto:
// zero import de valor com alias "@/".
const DEV_CLINIC_ID = "c0000000-0000-0000-0000-000000000001";

/**
 * Fluxo de acolhimento (FASE 4, ver acolhimento_requests em
 * supabase/migrations/20260917170600_acolhimento_requests.sql). A cadeia é
 * linear e varia só num ponto conforme o funding: particular passa por
 * `aguardando_pagamento` antes de `realizado` (recepção cobra na chegada);
 * convênio pula direto pra `realizado` (não há cobrança — a guia já cobre).
 * `cancelado` é alcançável de qualquer status não-terminal (ver
 * `nextStatuses` abaixo) — modelado como uma "saída de emergência" fora da
 * cadeia principal, não como mais um elo dela.
 */
export type AcolhimentoStatus =
  | "solicitado"
  | "aguardando_agendamento"
  | "agendado"
  | "aguardando_pagamento"
  | "realizado"
  | "contrato_pendente"
  | "grade_pendente"
  | "concluido"
  | "cancelado";

export type AcolhimentoFunding = "particular" | "convenio";

export const ACOLHIMENTO_STATUS_LABEL: Record<AcolhimentoStatus, string> = {
  solicitado: "Solicitado",
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  aguardando_pagamento: "Aguardando pagamento",
  realizado: "Realizado",
  contrato_pendente: "Contrato pendente",
  grade_pendente: "Grade pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const PARTICULAR_CHAIN: AcolhimentoStatus[] = [
  "solicitado",
  "aguardando_agendamento",
  "agendado",
  "aguardando_pagamento",
  "realizado",
  "contrato_pendente",
  "grade_pendente",
  "concluido",
];

const CONVENIO_CHAIN: AcolhimentoStatus[] = [
  "solicitado",
  "aguardando_agendamento",
  "agendado",
  "realizado",
  "contrato_pendente",
  "grade_pendente",
  "concluido",
];

const TERMINAL_STATUSES = new Set<AcolhimentoStatus>(["concluido", "cancelado"]);

/**
 * Próximos status possíveis a partir do status atual, dado o funding — pura,
 * sem I/O, pra dar pra testar isolada (tests/acolhimento-status.test.ts) e
 * reusar tanto na validação dos actions quanto nos botões da UI. Terminal
 * (`concluido`/`cancelado`) não tem próximo. Qualquer outro status sempre
 * pode ir pra `cancelado` além do próximo elo natural da cadeia.
 */
export function nextStatuses(status: AcolhimentoStatus, funding: AcolhimentoFunding): AcolhimentoStatus[] {
  if (TERMINAL_STATUSES.has(status)) return [];

  const chain = funding === "particular" ? PARTICULAR_CHAIN : CONVENIO_CHAIN;
  const idx = chain.indexOf(status);

  const result: AcolhimentoStatus[] = [];
  if (idx !== -1 && idx < chain.length - 1) {
    result.push(chain[idx + 1]);
  }
  result.push("cancelado");
  return result;
}

export type AcolhimentoRequestRow = {
  id: string;
  patientId: string;
  patientName: string;
  funding: AcolhimentoFunding;
  specialtyValue: string | null;
  insurerId: string | null;
  insurerName: string | null;
  status: AcolhimentoStatus;
  appointmentId: string | null;
  requestedBy: string | null;
  scheduledBy: string | null;
  supervisorId: string | null;
  paymentConfirmedAt: string | null;
  presenceConfirmedAt: string | null;
  contractDeliveredAt: string | null;
  gradeDefinedAt: string | null;
  familyInformedAt: string | null;
  whatsappGroupAt: string | null;
  referralDocumentId: string | null;
  authorizationId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Listagem de acolhimentos com nome do paciente e do convênio já resolvidos —
 * usada pelas telas de Gestor (solicitar) e Recepção (agendar/confirmar).
 * Filtros opcionais por status/funding pra cada tela pedir só o que precisa
 * mostrar (ex.: recepção só quer não-concluído/cancelado).
 */
export async function listAcolhimentoRequests(
  supabase: Supa,
  opts: { status?: AcolhimentoStatus | AcolhimentoStatus[]; funding?: AcolhimentoFunding; clinicId?: string } = {},
): Promise<AcolhimentoRequestRow[]> {
  let query = supabase
    .from("acolhimento_requests")
    .select(
      "id, patient_id, funding, specialty_value, insurer_id, status, appointment_id, requested_by, scheduled_by, supervisor_id, payment_confirmed_at, presence_confirmed_at, contract_delivered_at, grade_defined_at, family_informed_at, whatsapp_group_at, referral_document_id, authorization_id, notes, created_at, updated_at, patients(full_name), insurers(name)",
    )
    .eq("clinic_id", opts.clinicId ?? DEV_CLINIC_ID)
    .order("created_at", { ascending: false });

  if (opts.status) {
    query = Array.isArray(opts.status) ? query.in("status", opts.status) : query.eq("status", opts.status);
  }
  if (opts.funding) {
    query = query.eq("funding", opts.funding);
  }

  const { data } = await query;

  return (data ?? []).map((r) => {
    const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    const insurer = Array.isArray(r.insurers) ? r.insurers[0] : r.insurers;
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.full_name ?? "—",
      funding: r.funding as AcolhimentoFunding,
      specialtyValue: r.specialty_value,
      insurerId: r.insurer_id,
      insurerName: insurer?.name ?? null,
      status: r.status as AcolhimentoStatus,
      appointmentId: r.appointment_id,
      requestedBy: r.requested_by,
      scheduledBy: r.scheduled_by,
      supervisorId: r.supervisor_id,
      paymentConfirmedAt: r.payment_confirmed_at,
      presenceConfirmedAt: r.presence_confirmed_at,
      contractDeliveredAt: r.contract_delivered_at,
      gradeDefinedAt: r.grade_defined_at,
      familyInformedAt: r.family_informed_at,
      whatsappGroupAt: r.whatsapp_group_at,
      referralDocumentId: r.referral_document_id,
      authorizationId: r.authorization_id,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}
