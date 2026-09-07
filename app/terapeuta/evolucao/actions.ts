// app/terapeuta/evolucao/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
  GOAL_RESULT_LEVELS,
  buildSessionNoteStructured,
  type GoalResultLevel,
  type MetaTrabalhada,
} from "@/lib/session-note-fields";
import { getBehaviorCatalog } from "@/lib/behavior-catalog";
import { hashPin, isValidPinFormat, verifyPin } from "@/lib/signature-pin";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

export async function setSignaturePin(pin: string, confirmPin: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }
  if (!isValidPinFormat(pin)) {
    return { success: false, error: "O PIN deve ter de 4 a 6 dígitos." };
  }
  if (pin !== confirmPin) {
    return { success: false, error: "Os PINs não coincidem." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      signature_pin_hash: hashPin(pin),
      signature_pin_updated_at: new Date().toISOString(),
      signature_pin_failed_attempts: 0,
      signature_pin_locked_until: null,
    })
    .eq("id", user.id);

  if (error) {
    return { success: false, error: "Não foi possível salvar o PIN. Tente de novo." };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}

export async function createSessionNote(
  appointmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!appointmentId || !appointmentId.trim()) {
    return { success: false, error: "Sessão inválida." };
  }

  const supabase = await createClient();

  // O terapeuta que assina é sempre quem está logado — nunca um campo
  // vindo do cliente. Se não houver sessão, nem tentamos seguir.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const presencaRaw = formData.get("presenca_engajamento");
  const presenca = presencaRaw ? Number(presencaRaw) : NaN;

  if (!presencaRaw || Number.isNaN(presenca) || presenca < 1 || presenca > 5) {
    return { success: false, error: "Selecione a presença/engajamento (1 a 5)." };
  }

  // Catálogo de comportamentos-alvo da clínica (behavior_catalog, PRD §9.4
  // "lista configurável pelo supervisor") — substitui o antigo BEHAVIOR_TYPES
  // fixo. Buscamos aqui, não confiamos em nada vindo do form.
  const behaviorCatalog = await getBehaviorCatalog(supabase, { activeOnly: true });
  const behaviorTypes = formData.getAll("comportamento_tipo").map(String);
  const comportamentos = behaviorTypes
    .filter((tipo) => behaviorCatalog.some((b) => b.value === tipo))
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

  // opened_at (PRD §9.4, "medir o tempo entre abrir e assinar") — clampado:
  // se por qualquer motivo vier depois de created_at_device (relógio do
  // aparelho ajustado no meio do preenchimento, por exemplo), mandamos null
  // em vez de deixar a CHECK constraint (session_notes_opened_before_signed)
  // rejeitar o insert inteiro e o terapeuta perder a evolução.
  const openedAtRaw = String(formData.get("opened_at") ?? "");
  const openedAt =
    openedAtRaw && new Date(openedAtRaw).getTime() <= new Date(createdAtDevice).getTime()
      ? openedAtRaw
      : null;

  // Client de sessão: a RLS de `appointments` já garante que só devolve a
  // linha se o usuário logado tiver permissão de leitura (dono da sessão,
  // ou gestor/supervisor). Se vier vazio, tratamos como não encontrada —
  // nunca caímos pro admin client pra "contornar".
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, patient_id, status, therapist_id")
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
  // Quem assina é sempre o terapeuta logado (registrado em therapist_id do
  // insert abaixo, nunca um valor vindo do formulário/cliente) — mas não
  // precisa mais ser o terapeuta originalmente responsável pela sessão:
  // qualquer terapeuta (ou supervisor) da clínica pode assinar/editar,
  // espelhando a RLS de session_notes_insert.
  const { data: signerProfile, error: signerProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (signerProfileError || !signerProfile) {
    return { success: false, error: "Não foi possível verificar seu perfil. Tente de novo." };
  }
  if (signerProfile.role !== "terapeuta" && signerProfile.role !== "supervisor" && signerProfile.role !== "gestor") {
    return { success: false, error: "Seu perfil não tem permissão para assinar evoluções." };
  }

  // Metas trabalhadas (PRD §9.4): re-consultamos `plan_goals` no servidor e
  // descartamos qualquer id postado que não seja uma meta ATIVA de um plano
  // APROVADO deste paciente — nunca confiamos nos ids vindos do form, que o
  // cliente poderia adulterar. Mesmo filtro de getActiveGoalsForPatient
  // (lib/session-note-goals.ts), repetido aqui porque a Server Action não
  // pode confiar num resultado calculado no navegador.
  const { data: approvedPlans } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", appointment.patient_id)
    .eq("status", "aprovado");
  const approvedPlanIds = (approvedPlans ?? []).map((p) => p.id);

  let activeGoalIds = new Set<string>();
  if (approvedPlanIds.length > 0) {
    const { data: activeGoals } = await supabase
      .from("plan_goals")
      .select("id")
      .in("treatment_plan_id", approvedPlanIds)
      .eq("status", "ativa");
    activeGoalIds = new Set((activeGoals ?? []).map((g) => g.id));
  }

  const validResultLevels = new Set<GoalResultLevel>(GOAL_RESULT_LEVELS.map((r) => r.value));
  const metasTrabalhadas: MetaTrabalhada[] = [];
  for (const planGoalId of activeGoalIds) {
    const resultadoRaw = formData.get(`meta_${planGoalId}`);
    if (typeof resultadoRaw !== "string" || !resultadoRaw) continue;
    if (!validResultLevels.has(resultadoRaw as GoalResultLevel)) continue;
    metasTrabalhadas.push({ plan_goal_id: planGoalId, resultado: resultadoRaw as GoalResultLevel });
  }

  // Busca a versão mais recente (se houver) — a evolução é append-only:
  // uma vez assinada, editar significa inserir uma nova versão encadeada
  // por supersedes_id, nunca sobrescrever a linha existente.
  const { data: latestNote, error: latestNoteError } = await supabase
    .from("session_notes")
    .select("id, version")
    .eq("appointment_id", appointmentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestNoteError) {
    return { success: false, error: "Não foi possível verificar a sessão. Tente de novo." };
  }

  let editJustification: string | null = null;
  if (latestNote) {
    editJustification = String(formData.get("edit_justification") ?? "").trim() || null;
    if (!editJustification) {
      return { success: false, error: "Informe o motivo da edição desta evolução." };
    }
  }

  // Assinatura digital por PIN (PRD §9.4): confirma identidade além da
  // sessão logada antes de gravar signed_at. Nunca comparamos o PIN em
  // texto puro — só o hash em profiles.signature_pin_hash.
  const { data: pinProfile, error: pinProfileError } = await supabase
    .from("profiles")
    .select("signature_pin_hash, signature_pin_failed_attempts, signature_pin_locked_until")
    .eq("id", user.id)
    .maybeSingle();

  if (pinProfileError || !pinProfile) {
    return { success: false, error: "Não foi possível verificar seu PIN de assinatura." };
  }
  if (!pinProfile.signature_pin_hash) {
    return { success: false, error: "Configure um PIN de assinatura antes de assinar." };
  }
  if (pinProfile.signature_pin_locked_until && new Date(pinProfile.signature_pin_locked_until) > new Date()) {
    return {
      success: false,
      error: "PIN bloqueado por tentativas incorretas. Tente novamente mais tarde.",
    };
  }

  const pinInput = String(formData.get("signature_pin") ?? "").trim();
  if (!isValidPinFormat(pinInput)) {
    return { success: false, error: "Informe o PIN de assinatura (4 a 6 dígitos)." };
  }

  if (!verifyPin(pinInput, pinProfile.signature_pin_hash)) {
    const attempts = (pinProfile.signature_pin_failed_attempts ?? 0) + 1;
    const locked = attempts >= PIN_MAX_ATTEMPTS;
    await supabase
      .from("profiles")
      .update({
        signature_pin_failed_attempts: attempts,
        signature_pin_locked_until: locked ? new Date(Date.now() + PIN_LOCKOUT_MS).toISOString() : null,
      })
      .eq("id", user.id);
    return {
      success: false,
      error: locked
        ? "PIN incorreto. Muitas tentativas — bloqueado por 15 minutos."
        : "PIN incorreto.",
    };
  }

  if (pinProfile.signature_pin_failed_attempts) {
    await supabase
      .from("profiles")
      .update({ signature_pin_failed_attempts: 0, signature_pin_locked_until: null })
      .eq("id", user.id);
  }

  const structured = buildSessionNoteStructured({
    presencaEngajamento: presenca,
    metasTrabalhadas,
    comportamentos,
    orientacoes,
  });

  const { error } = await supabase.from("session_notes").insert({
    appointment_id: appointmentId,
    therapist_id: user.id,
    version: latestNote ? latestNote.version + 1 : 1,
    supersedes_id: latestNote ? latestNote.id : null,
    edit_justification: editJustification,
    structured,
    free_text: freeText || null,
    created_at_device: createdAtDevice,
    opened_at: openedAt,
    // signed_at = o mesmo instante de created_at_device (quando o
    // terapeuta apertou "Assinar" no aparelho), não `new Date()` aqui.
    // Com experimental.useOffline (next.config.ts), esta Server Action
    // fica pendente sem lançar erro enquanto a rede está fora e só
    // executa de fato quando a conexão volta — se usássemos `new Date()`
    // neste ponto, uma assinatura feita sem internet apareceria assinada
    // na hora em que o wi-fi voltou, não na hora real da sessão.
    signed_at: createdAtDevice,
  });

  if (error) {
    // Unique index em (appointment_id, version): se outro dispositivo/aba
    // já inseriu a próxima versão entre a leitura e este insert, o conflito
    // aparece aqui — nunca sobrescrevemos, só avisamos pra recarregar.
    if (error.code === "23505") {
      return {
        success: false,
        error: "Esta evolução foi editada em outro lugar enquanto você preenchia. Recarregue a página e tente de novo.",
      };
    }
    return { success: false, error: "Não foi possível salvar a evolução. Tente de novo." };
  }

  revalidatePath("/terapeuta");
  return { success: true };
}
