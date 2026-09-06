// app/terapeuta/evolucao/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
  type SessionNoteStructured,
} from "@/lib/session-note-fields";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

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

  // Client de sessão: a RLS de `appointments` já garante que só devolve a
  // linha se o usuário logado tiver permissão de leitura (dono da sessão,
  // ou gestor/supervisor). Se vier vazio, tratamos como não encontrada —
  // nunca caímos pro admin client pra "contornar".
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, status, therapist_id")
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
  // Quem assina é sempre o terapeuta logado, e só quando ele é o
  // responsável pela sessão — nunca um valor vindo do formulário/cliente.
  if (appointment.therapist_id !== user.id) {
    return { success: false, error: "Terapeuta não corresponde ao responsável pela sessão." };
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

  const structured: SessionNoteStructured = {
    presenca_engajamento: presenca,
    comportamentos,
    orientacoes,
  };

  const { error } = await supabase.from("session_notes").insert({
    appointment_id: appointmentId,
    therapist_id: user.id,
    version: latestNote ? latestNote.version + 1 : 1,
    supersedes_id: latestNote ? latestNote.id : null,
    edit_justification: editJustification,
    structured,
    free_text: freeText || null,
    created_at_device: createdAtDevice,
    signed_at: new Date().toISOString(),
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
