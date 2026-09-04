import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc, civilDateInTimeZone } from "@/lib/timezone";

export type EligibleSession = {
  appointmentId: string;
  patientName: string;
  startsAt: string;
  procedureCode: string;
  amount: number;
};

export type InconsistentSession = {
  appointmentId: string;
  patientName: string;
  startsAt: string;
  reason: string;
};

export type CompetenceEligibility = {
  eligible: EligibleSession[];
  inconsistent: InconsistentSession[];
};

/** `YYYY-MM-DD` do dia 1 do mês seguinte a `monthStr` (`YYYY-MM`). */
function nextMonthFirstDay(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * Elegibilidade de fechamento de competência (PRD §9.8 / Fase 1 "Fechamento
 * de competência"). Reusada pela Server Action de fechamento
 * (`app/faturamento/competencias/actions.ts`, que insere `billing_items`
 * pras sessões `eligible`) e pela página de detalhe da competência (que
 * exibe `inconsistent` recalculado on-the-fly, sem persistir nada).
 *
 * Critérios de elegibilidade de uma sessão (todos precisam ser verdade):
 * 1. `appointments.status = 'realizada'`
 * 2. `starts_at` dentro do mês de competência, em CLINIC_TIMEZONE
 * 3. paciente com `patient_insurance` vinculado a este convênio (`is_private=false`)
 * 4. existe `session_notes` pro appointment (evolução) — checado via RPC
 *    `session_note_pending`, já que a policy de leitura de `session_notes`
 *    não inclui o papel `faturamento` (só `gestor`/`supervisor`/terapeuta
 *    dono da sessão); a RPC é SECURITY DEFINER e escopada por clínica.
 * 5. `authorization_id` preenchido, com `authorizations.procedure_code`
 * 6. preço vigente em `insurer_price_tables` pra esse `(insurer_id, procedure_code)`
 *    na data da sessão
 *
 * Sessão que falha só no critério 4 (sem evolução ainda) é ignorada em
 * silêncio aqui — já é visível na métrica "Sessões sem evolução"
 * (`lib/session-note-pending.ts`) da home de faturamento. Sessão que passa
 * nos critérios 1-4 mas falha no 5 ou 6 é uma inconsistência, com motivo.
 */
export async function computeCompetenceEligibility(
  supabase: SupabaseClient<Database>,
  insurerId: string,
  monthStr: string,
): Promise<CompetenceEligibility> {
  const monthStart = `${monthStr}-01`;
  const monthStartUtc = zonedDateTimeToUtc(monthStart, "00:00", CLINIC_TIMEZONE).toISOString();
  const monthEndUtc = zonedDateTimeToUtc(
    nextMonthFirstDay(monthStr),
    "00:00",
    CLINIC_TIMEZONE,
  ).toISOString();

  const { data: insuredPatients } = await supabase
    .from("patient_insurance")
    .select("patient_id")
    .eq("insurer_id", insurerId)
    .eq("is_private", false);

  const patientIds = [...new Set((insuredPatients ?? []).map((p) => p.patient_id))];
  if (patientIds.length === 0) {
    return { eligible: [], inconsistent: [] };
  }

  const { data: candidates } = await supabase
    .from("appointments")
    .select("id, starts_at, authorization_id, patients(full_name)")
    .eq("status", "realizada")
    .in("patient_id", patientIds)
    .gte("starts_at", monthStartUtc)
    .lt("starts_at", monthEndUtc);

  const { data: priceRows } = await supabase
    .from("insurer_price_tables")
    .select("procedure_code, price, valid_from, valid_to")
    .eq("insurer_id", insurerId);

  const eligible: EligibleSession[] = [];
  const inconsistent: InconsistentSession[] = [];

  for (const appt of candidates ?? []) {
    // Critério 4: evolução assinada. `faturamento` não tem SELECT direto em
    // session_notes (RLS), então a checagem passa pela mesma RPC usada na
    // métrica "Sessões sem evolução".
    const { data: pending } = await supabase.rpc("session_note_pending", {
      p_appointment_id: appt.id,
    });
    if (pending) continue;

    const patientName = (appt.patients as { full_name: string } | null)?.full_name ?? "Paciente";

    if (!appt.authorization_id) {
      inconsistent.push({
        appointmentId: appt.id,
        patientName,
        startsAt: appt.starts_at,
        reason: "Sem autorização vinculada",
      });
      continue;
    }

    const { data: authorization } = await supabase
      .from("authorizations")
      .select("procedure_code")
      .eq("id", appt.authorization_id)
      .maybeSingle();

    if (!authorization) {
      inconsistent.push({
        appointmentId: appt.id,
        patientName,
        startsAt: appt.starts_at,
        reason: "Sem autorização vinculada",
      });
      continue;
    }

    const sessionDate = civilDateInTimeZone(new Date(appt.starts_at), CLINIC_TIMEZONE);
    const price = (priceRows ?? []).find(
      (p) =>
        p.procedure_code === authorization.procedure_code &&
        p.valid_from <= sessionDate &&
        (!p.valid_to || p.valid_to >= sessionDate),
    );

    if (!price) {
      inconsistent.push({
        appointmentId: appt.id,
        patientName,
        startsAt: appt.starts_at,
        reason: `Sem preço cadastrado para ${authorization.procedure_code}`,
      });
      continue;
    }

    eligible.push({
      appointmentId: appt.id,
      patientName,
      startsAt: appt.starts_at,
      procedureCode: authorization.procedure_code,
      amount: Number(price.price),
    });
  }

  return { eligible, inconsistent };
}
