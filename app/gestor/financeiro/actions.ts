"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { hoursBetween } from "../data";

type CloseResult =
  | { success: true; closedCount: number; skipped: string[] }
  | { success: false; error: string };

type MarkPaidResult = { success: true } | { success: false; error: string };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

function normalizeCompetenceMonth(input: string): string | null {
  const trimmed = input.trim();
  if (!MONTH_RE.test(trimmed)) return null;
  return trimmed.length === 7 ? `${trimmed}-01` : trimmed;
}

type ContractWindow = { hourlyRate: number; validFrom: number; validTo: number | null };

/** Taxa/hora vigente pra uma sessão específica — usa a data DA SESSÃO, não a de hoje, pois o fechamento pode ser de um mês passado com faixa já trocada depois. */
function rateAt(windows: ContractWindow[], sessionStartsAt: string): number | null {
  const at = new Date(sessionStartsAt).getTime();
  for (const w of windows) {
    if (w.validFrom <= at && (w.validTo == null || w.validTo >= at)) return w.hourlyRate;
  }
  return null;
}

/**
 * Fecha a competência de repasse do mês informado: para cada terapeuta
 * ativo da clínica com pelo menos 1 sessão `realizada` no mês, cria (ou
 * reprocessa, se já existir) a linha em `payouts` e as linhas de
 * `payout_items` correspondentes.
 *
 * Idempotente por design: reprocessar um payout ainda `aberto` apaga os
 * `payout_items` antigos e recria com o cálculo atual (útil se uma sessão
 * mudou de status ou um contrato foi corrigido depois do primeiro
 * fechamento). Um payout já `aprovado`/`pago` nunca é sobrescrito — o
 * terapeuta entra na lista `skipped` em vez disso.
 *
 * `rate_applied` em `payout_items` guarda o `hourly_rate` do contrato
 * vigente NA DATA da sessão (não o valor total pago por ela) — é o registro
 * de auditoria de "a que taxa essa sessão específica foi paga", consistente
 * com o nome da coluna. Como não há coluna de horas em `payout_items`, o
 * valor total (`payouts.gross_amount`) é calculado e armazenado à parte, em
 * vez de ser reconstituído por `sum(rate_applied)`.
 *
 * Sessões em grupo (`modality='grupo'`) podem se sobrepor no horário desde
 * a migration 20260904000024 — cada linha de `appointments` é uma sessão
 * paga independente, então a soma é sempre por linha, nunca deduplicando
 * por overlap de horário.
 */
export async function closePayouts(competenceMonthInput: string): Promise<CloseResult> {
  const competenceMonth = normalizeCompetenceMonth(competenceMonthInput);
  if (!competenceMonth) {
    return { success: false, error: "Informe uma competência válida (AAAA-MM)." };
  }

  const supabase = await createClient();

  const [year, month] = competenceMonth.split("-").map(Number);
  const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endISO = new Date(Date.UTC(year, month, 1)).toISOString();

  const { data: therapists } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("role", "terapeuta")
    .eq("active", true);
  const therapistList = therapists ?? [];
  if (therapistList.length === 0) return { success: true, closedCount: 0, skipped: [] };
  const ids = therapistList.map((t) => t.id);
  const nameById = new Map(therapistList.map((t) => [t.id, t.full_name]));

  const [{ data: contracts }, { data: sessions }, { data: existingPayouts }] = await Promise.all([
    supabase.from("therapist_contracts").select("profile_id, hourly_rate, valid_from, valid_to").in("profile_id", ids),
    supabase
      .from("appointments")
      .select("id, therapist_id, starts_at, ends_at")
      .in("therapist_id", ids)
      .eq("status", "realizada")
      .gte("starts_at", startISO)
      .lt("starts_at", endISO),
    supabase.from("payouts").select("id, therapist_id, status").in("therapist_id", ids).eq("competence_month", competenceMonth),
  ]);

  const windowsByTherapist = new Map<string, ContractWindow[]>();
  for (const c of contracts ?? []) {
    const arr = windowsByTherapist.get(c.profile_id) ?? [];
    arr.push({
      hourlyRate: Number(c.hourly_rate),
      validFrom: new Date(c.valid_from).getTime(),
      validTo: c.valid_to ? new Date(c.valid_to).getTime() : null,
    });
    windowsByTherapist.set(c.profile_id, arr);
  }

  const sessionsByTherapist = new Map<string, { id: string; starts_at: string; ends_at: string }[]>();
  for (const s of sessions ?? []) {
    const arr = sessionsByTherapist.get(s.therapist_id) ?? [];
    arr.push(s);
    sessionsByTherapist.set(s.therapist_id, arr);
  }

  const existingByTherapist = new Map((existingPayouts ?? []).map((p) => [p.therapist_id, p]));

  let closedCount = 0;
  const skipped: string[] = [];

  for (const therapistId of ids) {
    const mySessions = sessionsByTherapist.get(therapistId) ?? [];
    if (mySessions.length === 0) continue;

    const therapistName = nameById.get(therapistId) ?? "terapeuta";
    const existing = existingByTherapist.get(therapistId);
    if (existing && existing.status !== "aberto") {
      skipped.push(therapistName);
      continue;
    }

    const windows = windowsByTherapist.get(therapistId) ?? [];
    const items: { appointment_id: string; rate_applied: number }[] = [];
    let grossAmount = 0;
    for (const s of mySessions) {
      const rate = rateAt(windows, s.starts_at);
      if (rate == null) continue; // sem contrato vigente na data da sessão — fica de fora do fechamento
      grossAmount += hoursBetween(s.starts_at, s.ends_at) * rate;
      items.push({ appointment_id: s.id, rate_applied: rate });
    }
    if (items.length === 0) {
      skipped.push(therapistName);
      continue;
    }

    let payoutId: string;
    if (existing) {
      const { data: updated, error } = await supabase
        .from("payouts")
        .update({ sessions_count: items.length, gross_amount: grossAmount })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle();
      if (error || !updated) {
        return { success: false, error: `Não foi possível atualizar o repasse de ${therapistName}. Tente de novo.` };
      }
      payoutId = updated.id;

      const { error: deleteError } = await supabase.from("payout_items").delete().eq("payout_id", payoutId);
      if (deleteError) {
        return { success: false, error: `Não foi possível reprocessar os itens do repasse de ${therapistName}. Tente de novo.` };
      }
    } else {
      const { data: created, error } = await supabase
        .from("payouts")
        .insert({
          therapist_id: therapistId,
          competence_month: competenceMonth,
          sessions_count: items.length,
          gross_amount: grossAmount,
          status: "aberto",
        })
        .select("id")
        .single();
      if (error || !created) {
        return { success: false, error: `Não foi possível criar o repasse de ${therapistName}. Tente de novo.` };
      }
      payoutId = created.id;
    }

    const { error: itemsError } = await supabase
      .from("payout_items")
      .insert(items.map((it) => ({ payout_id: payoutId, appointment_id: it.appointment_id, rate_applied: it.rate_applied })));
    if (itemsError) {
      return { success: false, error: `Repasse de ${therapistName} salvo, mas não foi possível gravar os itens. Tente de novo.` };
    }

    closedCount += 1;
  }

  revalidatePath("/gestor/financeiro");
  revalidatePath("/faturamento/repasses");
  return { success: true, closedCount, skipped };
}

/** Transição simples de estado — só permitida a partir de `aberto`/`aprovado`, nunca de volta de `pago`. */
export async function markPayoutPaid(payoutId: string): Promise<MarkPaidResult> {
  if (!payoutId) return { success: false, error: "Repasse inválido." };

  const supabase = await createClient();

  const { data: payout } = await supabase.from("payouts").select("id, status").eq("id", payoutId).maybeSingle();
  if (!payout) return { success: false, error: "Repasse não encontrado." };
  if (payout.status === "pago") return { success: false, error: "Este repasse já está marcado como pago." };

  const { error } = await supabase.from("payouts").update({ status: "pago" }).eq("id", payoutId);
  if (error) return { success: false, error: "Não foi possível marcar o repasse como pago. Tente de novo." };

  revalidatePath("/gestor/financeiro");
  revalidatePath("/faturamento/repasses");
  revalidatePath("/terapeuta/repasse");
  return { success: true };
}
