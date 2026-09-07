// lib/intervention-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface InterventionLog {
  id: string;
  intervention_value: string;
  description: string | null;
  resultado: "sem_resposta" | "resposta_parcial" | "resposta_esperada" | null;
  recorded_at: string;
}

/**
 * Registra uma intervenção aplicada pelo terapeuta durante a sessão
 * (session_intervention_logs, supabase/migrations/
 * 20260907170007_intervention_catalog.sql). Mesmo desenho de
 * recordABCEvent (lib/aba-actions.ts): linha do tempo append-only, nunca
 * editada/apagada — o histórico completo é o que a evolução sintetiza.
 */
export async function recordIntervention(
  appointmentId: string,
  interventionValue: string,
  description: string,
  resultado: "sem_resposta" | "resposta_parcial" | "resposta_esperada" | null,
): Promise<{ success: boolean; log?: InterventionLog; error?: string }> {
  if (!appointmentId?.trim()) {
    return { success: false, error: "Sessão inválida." };
  }
  if (!interventionValue.trim()) {
    return { success: false, error: "Selecione a intervenção aplicada." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Usuário não autenticado." };
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }

  // Nunca confiamos no `value` vindo do cliente sem checar contra o
  // catálogo da clínica — mesmo critério de createSessionNote
  // (app/terapeuta/evolucao/actions.ts) para comportamentos.
  const { data: catalogMatch } = await supabase
    .from("intervention_catalog")
    .select("value")
    .eq("value", interventionValue.trim())
    .eq("active", true)
    .maybeSingle();

  if (!catalogMatch) {
    return { success: false, error: "Intervenção inválida." };
  }

  const { data, error } = await supabase
    .from("session_intervention_logs")
    .insert({
      appointment_id: appointmentId,
      patient_id: appointment.patient_id,
      therapist_id: user.id,
      intervention_value: catalogMatch.value,
      description: description.trim() || null,
      resultado,
    })
    .select("id, intervention_value, description, resultado, recorded_at")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Erro ao salvar intervenção." };
  }

  revalidatePath(`/terapeuta/evolucao/${appointmentId}`);
  return {
    success: true,
    log: {
      id: data.id,
      intervention_value: data.intervention_value,
      description: data.description,
      resultado: data.resultado as InterventionLog["resultado"],
      recorded_at: data.recorded_at,
    },
  };
}

/**
 * Busca intervenções já registradas nesta sessão, na ordem em que
 * aconteceram — usado tanto pela linha do tempo na UI quanto pela síntese
 * de texto por IA (generateAIEvolutionText, lib/aba-actions.ts).
 */
export async function getAppointmentInterventions(appointmentId: string): Promise<{
  success: boolean;
  logs?: InterventionLog[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_intervention_logs")
    .select("id, intervention_value, description, resultado, recorded_at")
    .eq("appointment_id", appointmentId)
    .order("recorded_at", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    logs: (data || []).map((d) => ({
      id: d.id,
      intervention_value: d.intervention_value,
      description: d.description,
      resultado: d.resultado as InterventionLog["resultado"],
      recorded_at: d.recorded_at,
    })),
  };
}
