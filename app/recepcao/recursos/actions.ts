"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { CLINIC_TIMEZONE, DEV_CLINIC_ID } from "@/lib/constants";
import { RESOURCE_CATEGORIES } from "@/lib/resource-categories";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cadastro de recurso (PRD §10) — RLS (resources_manage_gestor_supervisor)
 * é o portão real, restrito a gestor/supervisor.
 */
export async function createResource(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { success: false, error: "Dê um nome ao recurso." };
  if (!RESOURCE_CATEGORIES.some((c) => c.value === category)) {
    return { success: false, error: "Selecione uma categoria válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    category,
    notes: notes || null,
  });

  if (error) {
    return { success: false, error: "Você não tem permissão para cadastrar recursos." };
  }

  revalidatePath("/recepcao/recursos");
  return { success: true };
}

/**
 * Reserva de recurso (PRD §10) — bloqueio de concorrência é o
 * EXCLUDE USING GIST de resource_bookings (20260904000025_resources.sql),
 * não uma checagem em aplicação. O código 23P01 (exclusion_violation) é
 * traduzido pra mensagem amigável abaixo.
 */
export async function createResourceBooking(formData: FormData): Promise<ActionResult> {
  const resourceId = String(formData.get("resource_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!resourceId || !date || !startTime || !endTime) {
    return { success: false, error: "Preencha recurso, data e horário de início/fim." };
  }

  const startsAt = zonedDateTimeToUtc(date, startTime, CLINIC_TIMEZONE);
  const endsAt = zonedDateTimeToUtc(date, endTime, CLINIC_TIMEZONE);

  if (endsAt <= startsAt) {
    return { success: false, error: "O horário de término precisa ser depois do início." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase.from("resource_bookings").insert({
    resource_id: resourceId,
    booked_by: user.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });

  if (error) {
    if (error.code === "23P01") {
      return { success: false, error: "Recurso já reservado nesse horário." };
    }
    return { success: false, error: "Não foi possível reservar o recurso." };
  }

  revalidatePath("/recepcao/recursos");
  return { success: true };
}

export async function cancelResourceBooking(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // UPDATE sem policy aplicável não lança erro — só afeta 0 linhas
  // silenciosamente (mesmo comportamento notado em session_notes,
  // 013_full_suite_test.sql). O .select().maybeSingle() detecta esse caso.
  const { data, error } = await supabase
    .from("resource_bookings")
    .update({ status: "cancelado" })
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "Não foi possível cancelar — só quem reservou ou a recepção pode." };
  }

  revalidatePath("/recepcao/recursos");
  return { success: true };
}
