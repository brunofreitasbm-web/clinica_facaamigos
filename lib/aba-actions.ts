// lib/aba-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ProgramWithTrials {
  id: string;
  name: string;
  target_type: string;
  mastery_criterion: string | null;
  domain: string;
  trials: Array<{
    id: string;
    trial_index: number;
    result: string;
    prompt_level: string | null;
    duration_s: number | null;
    recorded_at: string;
  }>;
}

export interface ABCLog {
  id: string;
  antecedent: string;
  behavior_description: string;
  consequence: string;
  intensity: "leve" | "moderada" | "grave" | null;
  recorded_at: string;
}

/**
 * Busca todos os programas ativos do paciente vinculado à sessão informada,
 * juntamente com as tentativas registradas para esta sessão específica.
 */
export async function getAppointmentPrograms(appointmentId: string): Promise<{
  success: boolean;
  programs?: ProgramWithTrials[];
  patientName?: string;
  error?: string;
}> {
  if (!appointmentId?.trim()) {
    return { success: false, error: "ID da sessão inválido." };
  }

  const supabase = await createClient();

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, patient_id, patients(full_name)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (apptError || !appointment) {
    return { success: false, error: "Sessão não encontrada." };
  }

  const patientName = (appointment.patients as { full_name: string } | null)?.full_name ?? "Paciente";

  // Busca plano de tratamento aprovado do paciente
  const { data: treatmentPlan } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", appointment.patient_id)
    .eq("status", "aprovado")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!treatmentPlan) {
    return { success: true, programs: [], patientName };
  }

  // Busca metas do plano
  const { data: goals } = await supabase
    .from("plan_goals")
    .select("id, domain")
    .eq("treatment_plan_id", treatmentPlan.id)
    .eq("status", "ativa");

  if (!goals || goals.length === 0) {
    return { success: true, programs: [], patientName };
  }

  const goalIds = goals.map((g) => g.id);
  const goalDomainMap = new Map(goals.map((g) => [g.id, g.domain]));

  // Busca programas das metas ativas
  const { data: rawPrograms } = await supabase
    .from("programs")
    .select("id, name, target_type, mastery_criterion, plan_goal_id")
    .in("plan_goal_id", goalIds);

  if (!rawPrograms || rawPrograms.length === 0) {
    return { success: true, programs: [], patientName };
  }

  const programIds = rawPrograms.map((p) => p.id);

  // Busca tentativas já gravadas nesta sessão para estes programas
  const { data: trials } = await supabase
    .from("trial_data")
    .select("id, program_id, trial_index, result, prompt_level, duration_s, recorded_at")
    .eq("appointment_id", appointmentId)
    .in("program_id", programIds)
    .order("trial_index", { ascending: true });

  const trialMap = new Map<string, typeof trials>();
  (trials || []).forEach((t) => {
    const list = trialMap.get(t.program_id) || [];
    list.push(t);
    trialMap.set(t.program_id, list);
  });

  const formattedPrograms: ProgramWithTrials[] = rawPrograms.map((p) => ({
    id: p.id,
    name: p.name,
    target_type: p.target_type,
    mastery_criterion: p.mastery_criterion,
    domain: goalDomainMap.get(p.plan_goal_id) ?? "Geral",
    trials: (trialMap.get(p.id) || []).map((t) => ({
      id: t.id,
      trial_index: t.trial_index,
      result: t.result,
      prompt_level: t.prompt_level,
      duration_s: t.duration_s,
      recorded_at: t.recorded_at,
    })),
  }));

  return { success: true, programs: formattedPrograms, patientName };
}

/**
 * Salva um registro funcional ABC (Antecedente, Comportamento, Consequência) para a sessão.
 */
export async function recordABCEvent(
  appointmentId: string,
  antecedent: string,
  behaviorDescription: string,
  consequence: string,
  intensity: "leve" | "moderada" | "grave" = "leve",
): Promise<{ success: boolean; abcLog?: ABCLog; error?: string }> {
  if (!appointmentId?.trim()) {
    return { success: false, error: "Sessão inválida." };
  }
  if (!antecedent.trim() || !behaviorDescription.trim() || !consequence.trim()) {
    return { success: false, error: "Preencha antecedente, comportamento e consequência." };
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

  const { data, error } = await supabase
    .from("aba_abc_logs")
    .insert({
      appointment_id: appointmentId,
      patient_id: appointment.patient_id,
      therapist_id: user.id,
      antecedent: antecedent.trim(),
      behavior_description: behaviorDescription.trim(),
      consequence: consequence.trim(),
      intensity,
    })
    .select("id, antecedent, behavior_description, consequence, intensity, recorded_at")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Erro ao salvar registro ABC." };
  }

  revalidatePath(`/terapeuta/evolucao/${appointmentId}`);
  return {
    success: true,
    abcLog: {
      id: data.id,
      antecedent: data.antecedent,
      behavior_description: data.behavior_description,
      consequence: data.consequence,
      intensity: data.intensity as "leve" | "moderada" | "grave" | null,
      recorded_at: data.recorded_at,
    },
  };
}

/**
 * Busca registros ABC de uma sessão específica.
 */
export async function getAppointmentABCLogs(appointmentId: string): Promise<{
  success: boolean;
  logs?: ABCLog[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aba_abc_logs")
    .select("id, antecedent, behavior_description, consequence, intensity, recorded_at")
    .eq("appointment_id", appointmentId)
    .order("recorded_at", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    logs: (data || []).map((d) => ({
      id: d.id,
      antecedent: d.antecedent,
      behavior_description: d.behavior_description,
      consequence: d.consequence,
      intensity: d.intensity as "leve" | "moderada" | "grave" | null,
      recorded_at: d.recorded_at,
    })),
  };
}

/**
 * Sintetiza dados de tentativas e comportamentos da sessão em texto de evolução por IA.
 * Em ambiente real, pode chamar Gemini API / Edge Function.
 */
export async function generateAIEvolutionText(appointmentId: string): Promise<{
  success: boolean;
  generatedText?: string;
  error?: string;
}> {
  const supabase = await createClient();

  // 1. Busca dados da sessão, paciente e disciplina
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, discipline, patients(full_name)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appt) {
    return { success: false, error: "Sessão não encontrada." };
  }

  const patientName = (appt.patients as { full_name: string } | null)?.full_name || "O paciente";

  // 2. Busca tentativas da sessão
  const { data: trials } = await supabase
    .from("trial_data")
    .select("result, prompt_level, programs(name)")
    .eq("appointment_id", appointmentId);

  // 3. Busca registros ABC da sessão
  const { data: abcLogs } = await supabase
    .from("aba_abc_logs")
    .select("antecedent, behavior_description, consequence, intensity")
    .eq("appointment_id", appointmentId);

  // Processa estatísticas de tentativas
  const totalTrials = trials?.length || 0;
  const correctTrials = trials?.filter((t) => t.result === "correto").length || 0;
  const promptTrials = trials?.filter((t) => t.result === "ajuda").length || 0;
  const incorrectTrials = trials?.filter((t) => t.result === "incorreto").length || 0;

  const pctCorrect = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

  // Agrupa programas trabalhados
  const programMap = new Map<string, { total: number; correct: number }>();
  trials?.forEach((t) => {
    const progName = (t.programs as { name: string } | null)?.name || "Programa";
    const current = programMap.get(progName) || { total: 0, correct: 0 };
    current.total += 1;
    if (t.result === "correto") current.correct += 1;
    programMap.set(progName, current);
  });

  const programSummaryText = Array.from(programMap.entries())
    .map(([pName, pStat]) => {
      const pPct = Math.round((pStat.correct / pStat.total) * 100);
      return `- ${pName}: ${pStat.correct}/${pStat.total} acertos independentes (${pPct}%).`;
    })
    .join("\n");

  // Síntese comportamental ABC
  let abcText = "";
  if (abcLogs && abcLogs.length > 0) {
    abcText = `\nComportamentos observados durante a sessão:\n` +
      abcLogs
        .map(
          (log) =>
            `- Ocorrência de intensidade ${log.intensity || "leve"}: ${log.behavior_description} (Antecedente: ${log.antecedent} | Consequência: ${log.consequence}).`
        )
        .join("\n");
  } else {
    abcText = "\nNão foram registrados comportamentos disruptivos significativos durante o atendimento.";
  }

  const generatedText = `Sessão de ${appt.discipline.toUpperCase()} realizada com ${patientName}.\n\n` +
    `Métricas de Desempenho e Tentativas (${totalTrials} tentativas realizadas no total):\n` +
    (programSummaryText ? `${programSummaryText}\n` : "Tentativas aplicadas com foco na manutenção de engajamento.\n") +
    `Taxa global de respostas independentes: ${pctCorrect}% (${correctTrials} acertos, ${promptTrials} com suporte/ajuda, ${incorrectTrials} incorretos).\n` +
    `${abcText}\n\n` +
    `Conclusão: O paciente apresentou boa receptividade às atividades propostas, mantendo engajamento e progresso na esteira terapêutica.`;

  return { success: true, generatedText };
}

/**
 * Busca histórico de tentativas e desempenho para o gráfico de evolução ABA do paciente.
 */
export async function getPatientABAGraphData(patientId: string): Promise<{
  success: boolean;
  chartData?: Array<{
    date: string;
    sessionTitle: string;
    independentPct: number;
    promptPct: number;
    incorrectPct: number;
    totalTrials: number;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  // Busca sessões do paciente
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at, discipline")
    .eq("patient_id", patientId)
    .eq("status", "realizada")
    .order("starts_at", { ascending: true })
    .limit(20);

  if (!appointments || appointments.length === 0) {
    return { success: true, chartData: [] };
  }

  const apptIds = appointments.map((a) => a.id);

  const { data: trials } = await supabase
    .from("trial_data")
    .select("appointment_id, result")
    .in("appointment_id", apptIds);

  const apptTrialMap = new Map<string, Array<{ result: string }>>();
  trials?.forEach((t) => {
    const list = apptTrialMap.get(t.appointment_id) || [];
    list.push(t);
    apptTrialMap.set(t.appointment_id, list);
  });

  const chartData = appointments
    .map((appt) => {
      const apptTrials = apptTrialMap.get(appt.id) || [];
      const total = apptTrials.length;
      if (total === 0) return null;

      const correct = apptTrials.filter((t) => t.result === "correto").length;
      const prompt = apptTrials.filter((t) => t.result === "ajuda").length;
      const incorrect = apptTrials.filter((t) => t.result === "incorreto").length;

      const dateFormatted = new Date(appt.starts_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });

      return {
        date: dateFormatted,
        sessionTitle: `${dateFormatted} (${appt.discipline})`,
        independentPct: Math.round((correct / total) * 100),
        promptPct: Math.round((prompt / total) * 100),
        incorrectPct: Math.round((incorrect / total) * 100),
        totalTrials: total,
      };
    })
    .filter(Boolean) as Array<{
    date: string;
    sessionTitle: string;
    independentPct: number;
    promptPct: number;
    incorrectPct: number;
    totalTrials: number;
  }>;

  return { success: true, chartData };
}
