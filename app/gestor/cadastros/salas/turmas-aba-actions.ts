"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ABA_CLASS_START_TIMES, ABA_CLASS_WEEKDAYS } from "@/lib/aba-training";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Turma de Treino ABA. RLS (aba_training_classes_ins/upd/del) é o portão
 * real — restrito a supervisor/gestor — e o trigger
 * `aba_training_classes_room_guard` é quem garante que a sala é mesmo de
 * Treino ABA. As validações aqui só existem pra devolver mensagem legível
 * antes de bater no banco.
 */
export async function createAbaClass(formData: FormData): Promise<ActionResult> {
  const roomId = String(formData.get("roomId") ?? "").trim();
  const dayOfWeek = Number(formData.get("dayOfWeek") ?? NaN);
  const startTime = String(formData.get("startTime") ?? "").trim();

  if (!roomId) return { success: false, error: "Selecione a sala de Treino ABA." };
  if (!ABA_CLASS_WEEKDAYS.includes(dayOfWeek)) {
    return { success: false, error: "Selecione o dia da semana da turma." };
  }
  if (!(ABA_CLASS_START_TIMES as readonly string[]).includes(startTime)) {
    return { success: false, error: "Turma só abre às 8h, 10h, 14h ou 16h." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("aba_training_classes").insert({
    clinic_id: DEV_CLINIC_ID,
    room_id: roomId,
    day_of_week: dayOfWeek,
    start_time: startTime,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Já existe turma nessa sala, dia e horário." };
    }
    if (error.message?.includes("sala marcada como sala de Treino ABA")) {
      return { success: false, error: "Essa sala não está marcada como sala de Treino ABA." };
    }
    return { success: false, error: "Você não tem permissão para cadastrar turmas." };
  }

  revalidateAbaViews();
  return { success: true };
}

export async function setAbaClassActive(classId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("aba_training_classes").update({ active }).eq("id", classId);

  if (error) {
    return { success: false, error: "Não foi possível alterar a turma." };
  }

  revalidateAbaViews();
  return { success: true };
}

/**
 * Excluir só é possível enquanto a turma nunca foi usada — a FK
 * `appointments.aba_class_id` recusa o DELETE assim que existe sessão
 * ligada a ela, e nesse caso desativar é o caminho certo (preserva o
 * histórico).
 */
export async function deleteAbaClass(classId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("aba_training_classes").delete().eq("id", classId);

  if (error) {
    if (error.code === "23503") {
      return { success: false, error: "Turma já tem sessões agendadas — desative em vez de excluir." };
    }
    return { success: false, error: "Não foi possível excluir esta turma." };
  }

  revalidateAbaViews();
  return { success: true };
}

function revalidateAbaViews() {
  revalidatePath("/gestor/cadastros/salas");
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/agenda");
}
