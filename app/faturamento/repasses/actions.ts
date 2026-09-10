"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

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

/**
 * Fecha a competência de repasse do mês informado, por Módulo Assistencial
 * efetivamente entregue (cláusula 6ª do contrato-quadro PJ–PJ) — não é mais
 * hora × valor-hora por sessão.
 *
 * Delega inteiramente pra `close_payouts_for_month_authenticated` (RPC SQL),
 * que por sua vez chama `close_monthly_payouts_for_month` — a MESMA função
 * usada pelo cron mensal (`close_monthly_payouts`, `20260906000018`
 * reescrita em `20260910090300`). Isso elimina a duplicação de lógica
 * SQL/TS que existia no modelo antigo por hora (a action manual reimplementava
 * `close_monthly_payouts()` quase igual em TypeScript). A RPC já barra
 * internamente quem não é gestor/faturamento e nunca sobrescreve um payout
 * `aprovado`/`pago` — reprocessar um `aberto` apaga os `payout_items`
 * antigos e recria com o cálculo atual.
 */
export async function closePayouts(competenceMonthInput: string): Promise<CloseResult> {
  const competenceMonth = normalizeCompetenceMonth(competenceMonthInput);
  if (!competenceMonth) {
    return { success: false, error: "Informe uma competência válida (AAAA-MM)." };
  }

  const supabase = await createClient();

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

  const { error: rpcError } = await supabase.rpc("close_payouts_for_month_authenticated", {
    p_month: competenceMonth,
  });
  if (rpcError) {
    return {
      success: false,
      error: rpcError.message || "Não foi possível fechar a competência. Verifique sua permissão de gestor/faturamento.",
    };
  }

  const { data: payouts } = await supabase
    .from("payouts")
    .select("therapist_id, status")
    .in("therapist_id", ids)
    .eq("competence_month", competenceMonth);

  // Payouts que sobraram 'aberto' são exatamente os que este fechamento
  // (re)gravou agora; os com status != 'aberto' são os que já estavam
  // aprovado/pago antes e a RPC preservou sem sobrescrever.
  const closedCount = (payouts ?? []).filter((p) => p.status === "aberto").length;
  const skipped = (payouts ?? [])
    .filter((p) => p.status !== "aberto")
    .map((p) => nameById.get(p.therapist_id) ?? "terapeuta");

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
