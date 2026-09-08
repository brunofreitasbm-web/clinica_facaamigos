"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { sendTwilioNotificationAction } from "@/app/actions/twilio";

type ActionResult = { success: true } | { success: false; error: string };

const SHIFTS = ["manha", "tarde", "noite", "qualquer"] as const;

/** Adiciona um paciente à fila de espera de capacidade. RLS (waitlist_entries_write) restringe a gestor/supervisor. */
export async function addToWaitlist(formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const specialtyValue = String(formData.get("specialtyValue") ?? "").trim();
  const insurerId = String(formData.get("insurerId") ?? "").trim();
  const preferredShift = String(formData.get("preferredShift") ?? "qualquer");
  const priority = Number(formData.get("priority") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (!patientId) return { success: false, error: "Selecione um paciente." };
  if (!specialtyValue) return { success: false, error: "Selecione a especialidade necessária." };
  if (!SHIFTS.includes(preferredShift as (typeof SHIFTS)[number])) {
    return { success: false, error: "Selecione um turno válido." };
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 10) {
    return { success: false, error: "Prioridade precisa ser um número inteiro entre 0 e 10." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { error } = await supabase.from("waitlist_entries").insert({
    clinic_id: DEV_CLINIC_ID,
    patient_id: patientId,
    specialty_value: specialtyValue,
    insurer_id: insurerId || null,
    preferred_shift: preferredShift,
    priority,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) {
    return { success: false, error: "Não foi possível adicionar à fila — verifique se você tem permissão de gestor/supervisão." };
  }

  revalidatePath("/supervisao/lista-espera");
  return { success: true };
}

/**
 * Marca uma vaga como oferecida e opcionalmente dispara um WhatsApp pro
 * responsável financeiro do paciente avisando da vaga (reaproveita o mesmo
 * canal de notificação já usado no restante do sistema).
 */
export async function offerSlot(entryId: string, notifyGuardian: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: entry, error: entryError } = await supabase
    .from("waitlist_entries")
    .select("id, patient_id, status, specialty_value, patients(full_name, guardians(phone, is_financial))")
    .eq("id", entryId)
    .single();

  if (entryError || !entry) return { success: false, error: "Entrada não encontrada." };
  if (entry.status !== "aguardando") return { success: false, error: "Esta entrada já não está mais aguardando." };

  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "oferecido", offered_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) {
    return { success: false, error: "Não foi possível marcar a vaga como oferecida." };
  }

  if (notifyGuardian) {
    const patient = Array.isArray(entry.patients) ? entry.patients[0] : entry.patients;
    const guardians = patient?.guardians ?? [];
    const financial = (Array.isArray(guardians) ? guardians : [guardians]).find((g: any) => g?.is_financial) ?? (Array.isArray(guardians) ? guardians[0] : guardians);
    const phone = financial?.phone;
    if (phone) {
      await sendTwilioNotificationAction({
        to: phone,
        channel: "whatsapp",
        patientId: entry.patient_id,
        message: `Olá! Temos uma vaga disponível para ${patient?.full_name ?? "seu(sua) filho(a)"} em ${entry.specialty_value}. Entre em contato com a recepção para confirmar o horário.`,
      });
    }
  }

  revalidatePath("/supervisao/lista-espera");
  return { success: true };
}

export async function markScheduled(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").update({ status: "agendado" }).eq("id", entryId);

  if (error) return { success: false, error: "Não foi possível marcar como agendado." };

  revalidatePath("/supervisao/lista-espera");
  return { success: true };
}

export async function markWithdrawn(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_entries").update({ status: "desistiu" }).eq("id", entryId);

  if (error) return { success: false, error: "Não foi possível registrar a desistência." };

  revalidatePath("/supervisao/lista-espera");
  return { success: true };
}
