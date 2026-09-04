// app/terapeuta/evolucao/actions.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

export async function createSessionNote(
  appointmentId: string,
  therapistId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!appointmentId || !appointmentId.trim() || !therapistId || !therapistId.trim()) {
    return { success: false, error: "Sessão ou terapeuta inválido." };
  }

  const presencaRaw = formData.get("presenca_engajamento");
  const presenca = presencaRaw ? Number(presencaRaw) : NaN;

  if (!presencaRaw || Number.isNaN(presenca) || presenca < 1 || presenca > 5) {
    return { success: false, error: "Selecione a presença/engajamento (1 a 5)." };
  }

  const behaviorTypes = formData.getAll("comportamento_tipo").map(String);
  const comportamentos = behaviorTypes
    .filter((tipo) => BEHAVIOR_TYPES.some((b) => b.value === tipo))
    .map((tipo) => {
      const intensidadeRaw = String(formData.get(`comportamento_intensidade_${tipo}`) ?? "");
      const intensidade = BEHAVIOR_INTENSITIES.some((i) => i.value === intensidadeRaw)
        ? intensidadeRaw
        : "leve";
      return { tipo, intensidade };
    });

  const orientacoes = formData
    .getAll("orientacao")
    .map(String)
    .filter((valor) => FAMILY_GUIDANCE_OPTIONS.some((g) => g.value === valor));

  const freeText = String(formData.get("free_text") ?? "").trim();
  const createdAtDeviceRaw = String(formData.get("created_at_device") ?? "");
  const createdAtDevice = createdAtDeviceRaw || new Date().toISOString();

  const supabase = createAdminClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) {
    return { success: false, error: "Não foi possível verificar a sessão. Tente de novo." };
  }
  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.status !== "realizada") {
    return { success: false, error: "Esta sessão ainda não foi realizada." };
  }

  const { data: existingNote, error: existingNoteError } = await supabase
    .from("session_notes")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (existingNoteError) {
    return { success: false, error: "Não foi possível verificar a sessão. Tente de novo." };
  }
  if (existingNote) {
    return { success: false, error: "Já existe uma evolução registrada para esta sessão." };
  }

  const { error } = await supabase.from("session_notes").insert({
    appointment_id: appointmentId,
    therapist_id: therapistId,
    version: 1,
    structured: {
      presenca_engajamento: presenca,
      comportamentos,
      orientacoes,
    },
    free_text: freeText || null,
    created_at_device: createdAtDevice,
    signed_at: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar a evolução. Tente de novo." };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}
