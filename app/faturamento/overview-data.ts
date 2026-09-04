import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilDateInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { computeCompetenceEligibility } from "@/lib/billing-eligibility";

export type BlockedSession = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  therapistName: string;
  insurerId: string;
  insurerName: string;
  guideNumber: string | null;
  amount: number | null;
  startsAt: string;
  daysSinceSession: number;
};

export type InsurerBreakdown = {
  insurerId: string;
  insurerName: string;
  billingPeriodId: string | null;
  okAmount: number;
  okCount: number;
  glosaAmount: number;
  glosaCount: number;
  blockedAmount: number;
  blockedCount: number;
};

export type TraceEntry = { message: string; when: string | null };

export type CompetenceOverview = {
  monthStr: string;
  monthLabel: string;
  sessionsRealized: number;
  billableCount: number;
  billableAmount: number;
  blocked: BlockedSession[];
  byInsurer: InsurerBreakdown[];
  trace: TraceEntry[];
};

/** `YYYY-MM-DD` do dia 1 do mês seguinte a `monthStr` (`YYYY-MM`). Cópia
 * minúscula da mesma conta em lib/billing-eligibility.ts (não exportada de
 * lá) — duplicar 6 linhas aqui evita mexer num arquivo fora de
 * app/faturamento/**. */
function nextMonthFirstDay(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function monthLabelPtBr(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(date);
  return `${label} de ${year}`;
}

/**
 * Visão consolidada da competência corrente (mês civil atual em
 * CLINIC_TIMEZONE) pra home de faturamento (Faturamento.dc.html /
 * "Fechamento") — clínica inteira, todos os convênios de uma vez. A tela de
 * detalhe por convênio+mês (`competencias/[id]`) continua sendo o lugar
 * onde se fecha/reprocessa/exporta uma competência específica; aqui é só
 * leitura agregada.
 *
 * "Bloqueadas" é escopado a pacientes com convênio (`patient_insurance.
 * is_private=false`) porque é esse o universo que entra no pipeline de
 * `billing_items` (ver trigger `billing_items_requires_session_note` e
 * `computeCompetenceEligibility`); paciente particular não gera billing_item
 * de convênio nenhum, então não teria "convênio · guia" pra mostrar aqui.
 */
export async function getCurrentCompetenceOverview(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<CompetenceOverview> {
  const monthStr = civilDateInTimeZone(new Date(), CLINIC_TIMEZONE).slice(0, 7);
  const monthStartUtc = zonedDateTimeToUtc(`${monthStr}-01`, "00:00", CLINIC_TIMEZONE).toISOString();
  const monthEndUtc = zonedDateTimeToUtc(nextMonthFirstDay(monthStr), "00:00", CLINIC_TIMEZONE).toISOString();
  const competenceMonthDate = `${monthStr}-01`;

  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");

  const insurerNameById = new Map((insurers ?? []).map((i) => [i.id, i.name] as const));

  const { data: insuredPatients } = await supabase
    .from("patient_insurance")
    .select("patient_id, insurer_id")
    .eq("is_private", false)
    .not("insurer_id", "is", null);

  // Primeiro convênio não-particular encontrado por paciente — mesma regra
  // simplificadora usada no resto do app pra "o convênio do paciente".
  const insurerByPatient = new Map<string, string>();
  for (const row of insuredPatients ?? []) {
    if (row.insurer_id && !insurerByPatient.has(row.patient_id)) {
      insurerByPatient.set(row.patient_id, row.insurer_id);
    }
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, checkout_at, patient_id, authorization_id, patients(full_name), therapist:profiles!therapist_id(full_name)",
    )
    .eq("status", "realizada")
    .gte("starts_at", monthStartUtc)
    .lt("starts_at", monthEndUtc);

  const sessionsRealized = (appointments ?? []).length;

  // ── Bloqueadas: realizada + convênio vinculado + sem evolução assinada.
  const candidatesForBlocking = (appointments ?? []).filter((a) => insurerByPatient.has(a.patient_id));

  const pendingFlags = await Promise.all(
    candidatesForBlocking.map((a) => supabase.rpc("session_note_pending", { p_appointment_id: a.id })),
  );

  const blockedRaw = candidatesForBlocking.filter((_, idx) => pendingFlags[idx]?.data === true);

  const authorizationIds = [...new Set(blockedRaw.map((a) => a.authorization_id).filter((v): v is string => !!v))];
  const { data: authRows } =
    authorizationIds.length > 0
      ? await supabase
          .from("authorizations")
          .select("id, guide_number, procedure_code")
          .in("id", authorizationIds)
      : { data: [] as { id: string; guide_number: string | null; procedure_code: string }[] };
  const authById = new Map((authRows ?? []).map((a) => [a.id, a] as const));

  const blockedInsurerIds = [...new Set(blockedRaw.map((a) => insurerByPatient.get(a.patient_id)!))];
  const { data: priceRows } =
    blockedInsurerIds.length > 0
      ? await supabase
          .from("insurer_price_tables")
          .select("insurer_id, procedure_code, price, valid_from, valid_to")
          .in("insurer_id", blockedInsurerIds)
      : { data: [] as { insurer_id: string; procedure_code: string; price: number; valid_from: string; valid_to: string | null }[] };

  const now = Date.now();
  const blocked: BlockedSession[] = blockedRaw.map((a) => {
    const insurerId = insurerByPatient.get(a.patient_id)!;
    const auth = a.authorization_id ? authById.get(a.authorization_id) : undefined;
    const sessionDate = civilDateInTimeZone(new Date(a.starts_at), CLINIC_TIMEZONE);
    const price = auth
      ? (priceRows ?? []).find(
          (p) =>
            p.insurer_id === insurerId &&
            p.procedure_code === auth.procedure_code &&
            p.valid_from <= sessionDate &&
            (!p.valid_to || p.valid_to >= sessionDate),
        )
      : undefined;

    const reference = a.checkout_at ?? a.starts_at;
    const daysSinceSession = Math.max(0, Math.floor((now - new Date(reference).getTime()) / 86_400_000));

    return {
      appointmentId: a.id,
      patientId: a.patient_id,
      patientName: (a.patients as { full_name: string } | null)?.full_name ?? "Paciente",
      therapistName: (a.therapist as { full_name: string } | null)?.full_name ?? "Profissional",
      insurerId,
      insurerName: insurerNameById.get(insurerId) ?? "Convênio",
      guideNumber: auth?.guide_number ?? null,
      amount: price ? Number(price.price) : null,
      startsAt: a.starts_at,
      daysSinceSession,
    };
  });
  blocked.sort((a, b) => b.daysSinceSession - a.daysSinceSession);

  // ── Faturáveis com evolução e guia: reusa lib/billing-eligibility.ts por
  // convênio (já valida evolução + autorização + preço vigente) — nenhuma
  // reimplementação da regra de elegibilidade aqui.
  let billableCount = 0;
  let billableAmount = 0;
  for (const insurer of insurers ?? []) {
    const { eligible } = await computeCompetenceEligibility(supabase, insurer.id, monthStr);
    billableCount += eligible.length;
    billableAmount += eligible.reduce((sum, e) => sum + e.amount, 0);
  }

  // ── Por convênio: billing_items já gerados nesta competência (qualquer
  // convênio que já tenha billing_period aberto pro mês corrente).
  const { data: periods } = await supabase
    .from("billing_periods")
    .select("id, insurer_id, exported_at")
    .eq("competence_month", competenceMonthDate);

  const periodIds = (periods ?? []).map((p) => p.id);
  const periodById = new Map((periods ?? []).map((p) => [p.id, p] as const));

  const { data: items } =
    periodIds.length > 0
      ? await supabase
          .from("billing_items")
          .select(
            "id, amount, status, billing_period_id, appointment_id, appointments(authorization_id), glosas(reason_code, reason_text, amount)",
          )
          .in("billing_period_id", periodIds)
      : { data: [] as {
          id: string;
          amount: number;
          status: string;
          billing_period_id: string;
          appointment_id: string;
          appointments: { authorization_id: string | null } | null;
          glosas: { reason_code: string; reason_text: string | null; amount: number }[] | null;
        }[] };

  const breakdownByInsurer = new Map<string, InsurerBreakdown>();
  const ensureInsurer = (insurerId: string, billingPeriodId: string | null) => {
    if (!breakdownByInsurer.has(insurerId)) {
      breakdownByInsurer.set(insurerId, {
        insurerId,
        insurerName: insurerNameById.get(insurerId) ?? "Convênio",
        billingPeriodId,
        okAmount: 0,
        okCount: 0,
        glosaAmount: 0,
        glosaCount: 0,
        blockedAmount: 0,
        blockedCount: 0,
      });
    }
    return breakdownByInsurer.get(insurerId)!;
  };

  for (const b of blocked) {
    const entry = ensureInsurer(b.insurerId, null);
    entry.blockedCount += 1;
    entry.blockedAmount += b.amount ?? 0;
  }

  const traceGlosaAuthIds: string[] = [];
  for (const item of items ?? []) {
    const period = periodById.get(item.billing_period_id);
    if (!period) continue;
    const entry = ensureInsurer(period.insurer_id, period.id);
    if (!entry.billingPeriodId) entry.billingPeriodId = period.id;
    if (item.status === "glosado") {
      entry.glosaCount += 1;
      entry.glosaAmount += Number(item.amount);
    } else {
      entry.okCount += 1;
      entry.okAmount += Number(item.amount);
    }
    const authId = item.appointments?.authorization_id;
    if ((item.glosas ?? []).length > 0 && authId) traceGlosaAuthIds.push(authId);
  }

  const byInsurer = [...breakdownByInsurer.values()]
    .filter((e) => e.okCount + e.glosaCount + e.blockedCount > 0)
    .sort((a, b) => b.okAmount + b.glosaAmount + b.blockedAmount - (a.okAmount + a.glosaAmount + a.blockedAmount));

  // ── Rastro: eventos reais que dá pra atestar sem inventar hora — envio de
  // lote (tem `exported_at` de verdade) e glosas já lançadas nesta
  // competência (a tabela `glosas` não tem timestamp próprio, então a linha
  // não afirma "quando", só o quê).
  const { data: glosaAuthRows } =
    traceGlosaAuthIds.length > 0
      ? await supabase.from("authorizations").select("id, guide_number").in("id", traceGlosaAuthIds)
      : { data: [] as { id: string; guide_number: string | null }[] };
  const guideByAuthId = new Map((glosaAuthRows ?? []).map((a) => [a.id, a.guide_number] as const));

  const trace: TraceEntry[] = [];
  for (const period of periods ?? []) {
    if (period.exported_at) {
      trace.push({
        message: `Lote exportado · ${insurerNameById.get(period.insurer_id) ?? "Convênio"}`,
        when: period.exported_at,
      });
    }
  }
  for (const item of items ?? []) {
    const period = periodById.get(item.billing_period_id);
    for (const g of item.glosas ?? []) {
      const authId = item.appointments?.authorization_id;
      const guide = authId ? guideByAuthId.get(authId) : null;
      trace.push({
        message: `Glosa registrada · ${insurerNameById.get(period?.insurer_id ?? "") ?? "Convênio"} · guia ${
          guide ?? "—"
        } · código ${g.reason_code}`,
        when: null,
      });
    }
  }
  trace.sort((a, b) => {
    if (a.when && b.when) return b.when.localeCompare(a.when);
    if (a.when) return -1;
    if (b.when) return 1;
    return 0;
  });

  return {
    monthStr,
    monthLabel: monthLabelPtBr(monthStr),
    sessionsRealized,
    billableCount,
    billableAmount,
    blocked,
    byInsurer,
    trace: trace.slice(0, 10),
  };
}
