"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

const PENDING_STATUS = "aguardando_aprovacao_supervisao";

/** Motivo gravado na recusa: a coordenação não aceitou o horário que a família escolheu. */
const REJECTION_REASON = "Horário não aceito pela coordenação";

async function loadPending(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sua sessão expirou. Entre de novo." };

  const { data: appointment } = await supabase.from("appointments").select("id, status").eq("id", appointmentId).maybeSingle();
  if (!appointment) return { ok: false as const, error: "Horário não encontrado." };
  if (appointment.status !== PENDING_STATUS) {
    return { ok: false as const, error: "Este horário já foi decidido. Atualize a página." };
  }
  return { ok: true as const, supabase, user };
}

/** Aprovar libera o horário escolhido pela família para a confirmação final. */
export async function approveRescheduling(appointmentId: string): Promise<ActionResult> {
  const ctx = await loadPending(appointmentId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { error } = await ctx.supabase.from("appointments").update({ status: "agendada" }).eq("id", appointmentId).eq("status", PENDING_STATUS);
  if (error) return { success: false, error: "Não foi possível aprovar. Tente de novo." };

  revalidatePath("/supervisao/reagendamentos");
  revalidatePath("/recepcao");
  return { success: true };
}

/**
 * Recusar CANCELA o horário com motivo e quem decidiu (antes apagava o registro, sem
 * rastro). A família ainda não é avisada pelo sistema: a tela diz isso ao coordenador.
 */
export async function rejectRescheduling(appointmentId: string): Promise<ActionResult> {
  const ctx = await loadPending(appointmentId);
  if (!ctx.ok) return { success: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("appointments")
    .update({
      status: "cancelada_clinica",
      cancel_reason: REJECTION_REASON,
      cancelled_by: ctx.user.id,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("status", PENDING_STATUS);
  if (error) return { success: false, error: "Não foi possível recusar. Tente de novo." };

  revalidatePath("/supervisao/reagendamentos");
  revalidatePath("/recepcao");
  return { success: true };
}
