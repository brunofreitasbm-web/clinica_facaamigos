// lib/conversation-attendance.ts
// Fechamento de atendimentos (conversation_attendances, migration
// 20260920000000). Abertura, carimbos de resposta, escalação e agendamento são
// preenchidos por triggers no banco; aqui ficam só os fechamentos que dependem
// de uma decisão do app (bot concluiu / recepção informou o desfecho).
import { createAdminClient } from "@/lib/supabase/admin";

export const ATTENDANCE_MANUAL_OUTCOMES = ["agendado", "resolvido", "perdido", "spam"] as const;
export type AttendanceManualOutcome = (typeof ATTENDANCE_MANUAL_OUTCOMES)[number];

/**
 * O bot deu a resposta definitiva e a pessoa sinalizou que não precisa de
 * mais nada. Chamar DEPOIS de gravar a mensagem outbound do bot — o trigger de
 * `messages` só carimba first_bot_reply_at em atendimento ainda aberto. Uma
 * nova mensagem do contato abre um novo atendimento sozinha.
 */
export async function closeAttendanceResolvedByBot(conversationId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("conversation_attendances")
      .update({ closed_at: new Date().toISOString(), outcome: "resolvido", closed_by_kind: "bot" })
      .eq("conversation_id", conversationId)
      .is("closed_at", null);
  } catch (err) {
    console.error("[Attendance] Falha ao fechar atendimento resolvido pelo bot:", err);
  }
}
