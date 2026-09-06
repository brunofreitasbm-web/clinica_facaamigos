// lib/grade-recurrence.ts
//
// Camada TS fina sobre as funções SQL de supabase/migrations/
// 20260906000017_grade_recurrence_generation.sql. Toda a lógica de geração
// (cálculo de datas, pulo de duplicata, tratamento de conflito por sessão)
// vive em SQL — aqui só existe tipagem, tradução de nomes de campo e as
// duas operações que fazem sentido compor no lado do app:
//
//  - editar a grade (cancelar futuro da série antiga + gerar a nova) precisa
//    de uma transação lógica entre um UPDATE e uma chamada de função, o que
//    não dá pra expressar como uma única função SQL sem duplicar a política
//    de quem pode cancelar/criar (RLS já cobre isso via `supabase` recebido
//    aqui, que carrega a sessão do usuário logado);
//  - as duas funções de geração (`generate_recurrence_sessions` e
//    `generate_from_recurrence_anchor`) já são "security invoker": o INSERT
//    interno respeita as mesmas RLS policies de `appointments` que
//    `createAppointment` (app/recepcao/agenda/actions.ts) usa hoje.
//
// A regeneração periódica (~8 semanas geradas por série ativa) roda via
// pg_cron chamando `regenerate_active_grade_sessions` diretamente em SQL —
// não há wrapper TS pra ela porque não há chamador no app (é cron-only).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { randomUUID } from "node:crypto";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";

/** Padrão semanal de uma série da grade — os mesmos campos que definem uma linha de `appointments`. */
export type GradeSeriesPattern = {
  patientId: string;
  therapistId: string;
  roomId: string;
  discipline: string;
  appointmentTypeId: string | null;
  modality: string;
  authorizationId: string | null;
  isProvisional: boolean;
  /** 0=domingo..6=sábado — mesma convenção de `extract(dow)` do Postgres e `Date.getUTCDay()`. */
  weekday: number;
  /** Hora civil da clínica, `"HH:mm"` ou `"HH:mm:ss"`. */
  timeOfDay: string;
  durationMinutes: number;
};

export type GenerateOccurrenceResult = {
  startsAt: string;
  created: boolean;
  error: string | null;
};

type RawOccurrenceRow = { starts_at: string; created: boolean; error: string | null };

function mapRows(rows: RawOccurrenceRow[] | null): GenerateOccurrenceResult[] {
  return (rows ?? []).map((r) => ({ startsAt: r.starts_at, created: r.created, error: r.error }));
}

/**
 * Gera as próximas `weeksAhead` sessões de uma série nova (recurrence_id
 * ainda não usado em `appointments`) a partir de `fromDate` (hoje, se
 * omitido). Usada tanto para "publicar" uma série inédita quanto pela
 * segunda metade de `editGradeSeries` (o novo padrão, depois de cancelar o
 * antigo).
 */
export async function generateNewSeries(
  supabase: SupabaseClient<Database>,
  pattern: GradeSeriesPattern,
  options: { weeksAhead?: number; fromDate?: string; recurrenceId?: string } = {},
): Promise<{ recurrenceId: string; results: GenerateOccurrenceResult[] }> {
  const recurrenceId = options.recurrenceId ?? randomUUID();

  const { data, error } = await supabase.rpc("generate_recurrence_sessions", {
    p_recurrence_id: recurrenceId,
    p_patient_id: pattern.patientId,
    p_therapist_id: pattern.therapistId,
    p_room_id: pattern.roomId,
    p_discipline: pattern.discipline,
    p_appointment_type_id: pattern.appointmentTypeId,
    p_modality: pattern.modality,
    p_authorization_id: pattern.authorizationId,
    p_is_provisional: pattern.isProvisional,
    p_weekday: pattern.weekday,
    p_time_of_day: pattern.timeOfDay,
    p_duration_minutes: pattern.durationMinutes,
    p_weeks_ahead: options.weeksAhead ?? 8,
    p_from_date: options.fromDate ?? null,
  });

  if (error) {
    throw new Error(`Não foi possível gerar as sessões da série: ${error.message}`);
  }

  return { recurrenceId, results: mapRows(data as RawOccurrenceRow[] | null) };
}

/**
 * Continua uma série já existente (usa a sessão mais recente e não
 * cancelada daquele `recurrenceId` como padrão) — "gerar mais semanas" sem
 * precisar reinformar paciente/terapeuta/sala/horário.
 */
export async function generateSeriesSessions(
  supabase: SupabaseClient<Database>,
  recurrenceId: string,
  weeksAhead = 8,
): Promise<GenerateOccurrenceResult[]> {
  const { data, error } = await supabase.rpc("generate_from_recurrence_anchor", {
    p_recurrence_id: recurrenceId,
    p_weeks_ahead: weeksAhead,
  });

  if (error) {
    throw new Error(`Não foi possível gerar as sessões da série: ${error.message}`);
  }

  return mapRows(data as RawOccurrenceRow[] | null);
}

export type EditGradeSeriesParams = {
  /** `recurrence_id` da série atual, cujas sessões futuras ainda não realizadas serão canceladas. */
  oldRecurrenceId: string;
  /** Data (`YYYY-MM-DD`, civil da clínica) a partir da qual a mudança vale — sessões antes disso não são tocadas. */
  effectiveDate: string;
  /** Motivo gravado em `cancel_reason` das sessões antigas canceladas. */
  cancelReason: string;
  /** `profiles.id` de quem está editando a grade (vira `cancelled_by`). */
  cancelledBy: string;
  /** Novo padrão semanal, já vigente a partir de `effectiveDate`. */
  newPattern: GradeSeriesPattern;
  weeksAhead?: number;
};

export type EditGradeSeriesResult = {
  cancelledCount: number;
  newRecurrenceId: string;
  results: GenerateOccurrenceResult[];
};

/**
 * "Editar a grade": muda dia/horário/terapeuta/sala de uma série a partir
 * de uma data. Não mexe em sessões passadas ou já realizadas (o filtro de
 * status abaixo só pega 'agendada'/'confirmada' — mesmo universo que
 * `markMissedOrCancelled` em app/recepcao/agenda/session-actions.ts já
 * trata como cancelável) e nunca sobrescreve o `recurrence_id` antigo — a
 * série nova nasce com um id novo, preservando o histórico da série antiga
 * intacto para auditoria/relatórios.
 */
export async function editGradeSeries(
  supabase: SupabaseClient<Database>,
  params: EditGradeSeriesParams,
): Promise<EditGradeSeriesResult> {
  const effectiveInstant = zonedDateTimeToUtc(params.effectiveDate, "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: cancelled, error: cancelError } = await supabase
    .from("appointments")
    .update({
      status: "cancelada_clinica",
      cancel_reason: params.cancelReason,
      cancelled_by: params.cancelledBy,
      cancelled_at: new Date().toISOString(),
    })
    .eq("recurrence_id", params.oldRecurrenceId)
    .in("status", ["agendada", "confirmada"])
    .gte("starts_at", effectiveInstant)
    .select("id");

  if (cancelError) {
    throw new Error(`Não foi possível cancelar as sessões futuras da série antiga: ${cancelError.message}`);
  }

  const { recurrenceId, results } = await generateNewSeries(supabase, params.newPattern, {
    weeksAhead: params.weeksAhead,
    fromDate: params.effectiveDate,
  });

  return { cancelledCount: cancelled?.length ?? 0, newRecurrenceId: recurrenceId, results };
}
