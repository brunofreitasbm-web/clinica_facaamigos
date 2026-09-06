"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { logRecordAccess } from "@/lib/record-access-log";

export type CreateInteressadoInput = {
  fullName: string;
  birthDate?: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship?: string;
  origin?: string;
  chiefComplaint?: string;
};

/**
 * Interessado Rápido (≤ 30 segundos - §9.1 do PRD)
 * Cadastra o paciente com status inicial 'interessado' e vincula o primeiro responsável.
 */
export async function createInteressadoAction(input: CreateInteressadoInput): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    if (!input.fullName.trim()) {
      return { success: false, error: "Nome do paciente é obrigatório." };
    }
    if (!input.guardianPhone.trim()) {
      return { success: false, error: "Telefone do responsável é obrigatório." };
    }

    // 1. Inserir paciente em status 'interessado'
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        full_name: input.fullName.trim(),
        birth_date: input.birthDate || "2020-01-01",
        status: "interessado",
        entry_source: input.origin || "Recepção",
        complaint: input.chiefComplaint?.trim() || null,
      })
      .select("id")
      .single();

    if (patientErr || !patient) {
      console.error("Erro ao cadastrar interessado paciente:", patientErr);
      return { success: false, error: patientErr?.message || "Falha ao criar paciente." };
    }

    // 2. Inserir o primeiro responsável (guardian)
    const { error: guardianErr } = await supabase.from("guardians").insert({
      patient_id: patient.id,
      full_name: input.guardianName.trim() || `Responsável de ${input.fullName.trim()}`,
      phone: input.guardianPhone.trim(),
      relationship: input.guardianRelationship || "Responsável",
      is_emergency_contact: true,
      is_financial: true,
    });

    if (guardianErr) {
      console.error("Erro ao cadastrar responsável do interessado:", guardianErr);
    }

    revalidatePath("/recepcao");
    revalidatePath("/recepcao/pacientes");

    return { success: true, patientId: patient.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao criar interessado.";
    return { success: false, error: msg };
  }
}

/**
 * Converter Sessão Provisória para Real (§9.1 do PRD)
 * Transiciona `is_provisional = false` vinculando a `authorization_id` autorizada.
 */
export async function convertProvisionalAppointmentAction(
  appointmentId: string,
  authorizationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    if (!authorizationId) {
      return { success: false, error: "É necessário selecionar uma autorização válida." };
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        is_provisional: false,
        authorization_id: authorizationId,
      })
      .eq("id", appointmentId);

    if (error) {
      console.error("Erro ao converter agendamento provisório:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/recepcao");
    revalidatePath("/recepcao/agenda");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao converter agendamento.";
    return { success: false, error: msg };
  }
}

/**
 * Registrar Falta / Cancelamento com Motivo Padronizado (§9.2 do PRD)
 */
export async function recordSessionAbsenceAction(input: {
  appointmentId: string;
  status: "cancelada_familia" | "cancelada_clinica" | "falta_familia" | "falta_clinica";
  cancelReason: string;
  cancelledByRole?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("appointments")
      .update({
        status: input.status,
        cancel_reason: input.cancelReason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id || null,
      })
      .eq("id", input.appointmentId);

    if (error) {
      console.error("Erro ao registrar falta/cancelamento:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/recepcao");
    revalidatePath("/recepcao/agenda");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao registrar ausência.";
    return { success: false, error: msg };
  }
}

/**
 * Registrar Acesso a Prontuário para LGPD Compliance (§9.5 do PRD)
 */
export async function logPatientRecordAccessAction(patientId: string, reason: string): Promise<void> {
  try {
    const supabase = await createClient();
    await logRecordAccess(supabase, patientId, reason);
  } catch (err) {
    console.error("Erro ao registrar log de acesso LGPD:", err);
  }
}
