// app/terapeuta/evolucao/[appointmentId]/trial-data-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { TRIAL_RESULTS, type TrialResult } from "@/lib/trial-data";
import { revalidatePath } from "next/cache";

type RecordTrialResult =
  | { success: true; trialIndex: number }
  | { success: false; error: string };

export async function recordTrial(
  appointmentId: string,
  programId: string,
  formData: FormData,
): Promise<RecordTrialResult> {
  if (!appointmentId?.trim() || !programId?.trim()) {
    return { success: false, error: "Sessão ou programa inválido." };
  }

  const resultRaw = String(formData.get("result") ?? "");
  if (!TRIAL_RESULTS.includes(resultRaw as TrialResult)) {
    return { success: false, error: "Selecione um resultado válido para a tentativa." };
  }
  const result = resultRaw as TrialResult;

  const promptLevelRaw = String(formData.get("prompt_level") ?? "").trim();
  const promptLevel = promptLevelRaw ? promptLevelRaw.slice(0, 100) : null;

  const durationRaw = formData.get("duration_s");
  let durationS: number | null = null;
  if (durationRaw !== null && String(durationRaw).trim() !== "") {
    const parsed = Number(durationRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { success: false, error: "Duração inválida." };
    }
    durationS = parsed;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  // Mesma checagem defensiva do fluxo de evolução: a RLS de `appointments`
  // já restringe a leitura, mas confirmamos aqui que quem está logado é o
  // terapeuta responsável e que a sessão já aconteceu — nunca confiamos em
  // valor vindo do cliente pra isso.
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, status, therapist_id, patient_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) {
    return { success: false, error: "Não foi possível verificar a sessão. Tente de novo." };
  }
  if (!appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }
  if (appointment.therapist_id !== user.id) {
    return { success: false, error: "Terapeuta não corresponde ao responsável pela sessão." };
  }
  if (appointment.status !== "realizada") {
    return { success: false, error: "Esta sessão ainda não foi realizada." };
  }

  // `program_id` chega do formulário: a policy de INSERT de `trial_data` só
  // confere o dono da sessão, não se o programa é do mesmo paciente — então
  // validamos aqui pra não gravar tentativa de programa de outro paciente.
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, plan_goals(treatment_plan_id, treatment_plans(patient_id, status))")
    .eq("id", programId)
    .maybeSingle();

  if (programError) {
    return { success: false, error: "Não foi possível verificar o programa. Tente de novo." };
  }

  const planGoal = program?.plan_goals as {
    treatment_plan_id: string;
    treatment_plans: { patient_id: string; status: string } | null;
  } | null;
  const treatmentPlan = planGoal?.treatment_plans ?? null;

  if (
    !program ||
    !treatmentPlan ||
    treatmentPlan.patient_id !== appointment.patient_id ||
    treatmentPlan.status !== "aprovado"
  ) {
    return { success: false, error: "Programa não encontrado para esta sessão." };
  }

  // `trial_index` não é gerado pelo banco — contamos quantas tentativas já
  // existem pra este (appointment, programa) e incrementamos. Recalcular a
  // cada chamada (em vez de só confiar num contador client-side) evita
  // sequência furada se a página recarregar no meio da sessão.
  const { count, error: countError } = await supabase
    .from("trial_data")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId)
    .eq("program_id", programId);

  if (countError) {
    return { success: false, error: "Não foi possível calcular a tentativa. Tente de novo." };
  }

  const trialIndex = (count ?? 0) + 1;

  const { error: insertError } = await supabase.from("trial_data").insert({
    appointment_id: appointmentId,
    program_id: programId,
    trial_index: trialIndex,
    result,
    prompt_level: promptLevel,
    duration_s: durationS,
  });

  if (insertError) {
    return { success: false, error: "Não foi possível salvar a tentativa. Tente de novo." };
  }

  revalidatePath(`/terapeuta/evolucao/${appointmentId}`);
  return { success: true, trialIndex };
}
