"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Código de procedimento por convênio+especialidade (insurer_procedure_codes)
 * — RLS de escrita restrita a gestor/faturamento. Usada por
 * `resolve_procedure_code` (SQL) para a competência de faturamento e pela
 * função de checagem de sessão em grupo (group_allowed/max_group_size).
 */
export async function upsertInsurerProcedureCode(
  insurerId: string,
  formData: FormData,
): Promise<ActionResult> {
  const specialtyValue = String(formData.get("specialty_value") ?? "").trim();
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const procedureName = String(formData.get("procedure_name") ?? "").trim();
  const requiresPriorAuth = formData.get("requires_prior_auth") === "on";
  const groupAllowed = formData.get("group_allowed") === "on";
  const maxGroupSizeRaw = String(formData.get("max_group_size") ?? "").trim();
  const sessionMinutesRaw = String(formData.get("session_minutes") ?? "").trim();

  if (!insurerId || !specialtyValue) {
    return { success: false, error: "Convênio e especialidade são obrigatórios." };
  }

  if (!procedureCode) {
    return { success: false, error: "Código do procedimento é obrigatório." };
  }

  const maxGroupSize = maxGroupSizeRaw ? Number(maxGroupSizeRaw) : 3;
  if (!Number.isFinite(maxGroupSize) || maxGroupSize <= 0) {
    return { success: false, error: "Tamanho máximo do grupo deve ser maior que zero." };
  }

  const sessionMinutes = sessionMinutesRaw ? Number(sessionMinutesRaw) : null;
  if (sessionMinutesRaw && (!Number.isFinite(sessionMinutes) || (sessionMinutes as number) <= 0)) {
    return { success: false, error: "Duração da sessão deve ser maior que zero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("insurer_procedure_codes").upsert(
    {
      insurer_id: insurerId,
      specialty_value: specialtyValue,
      procedure_code: procedureCode,
      procedure_name: procedureName || null,
      requires_prior_auth: requiresPriorAuth,
      group_allowed: groupAllowed,
      max_group_size: maxGroupSize,
      session_minutes: sessionMinutes,
    },
    { onConflict: "insurer_id,specialty_value" },
  );

  if (error) {
    return {
      success: false,
      error: `Não foi possível salvar o código de procedimento — verifique se você tem permissão de gestor/faturamento. (${error.message})`,
    };
  }

  revalidatePath(`/gestor/cadastros/convenios/${insurerId}/procedimentos`);
  return { success: true };
}

export async function deleteInsurerProcedureCode(
  insurerId: string,
  id: string,
): Promise<ActionResult> {
  if (!id) return { success: false, error: "Código de procedimento inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("insurer_procedure_codes")
    .delete()
    .eq("id", id)
    .eq("insurer_id", insurerId);

  if (error) {
    return {
      success: false,
      error: `Não foi possível excluir o código de procedimento. (${error.message})`,
    };
  }

  revalidatePath(`/gestor/cadastros/convenios/${insurerId}/procedimentos`);
  return { success: true };
}
