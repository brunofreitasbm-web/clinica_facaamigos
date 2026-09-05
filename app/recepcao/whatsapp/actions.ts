"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { buildD1ReminderMessage, buildWhatsappLink } from "@/lib/whatsapp-message";

export interface WhatsappQueueItem {
  appointmentId: string;
  patientId: string;
  patientName: string;
  guardianId: string | null;
  guardianName: string;
  guardianPhone: string | null;
  discipline: string;
  roomName: string;
  appointmentDate: string;
  appointmentTime: string;
  message: string;
  whatsappLink: string | null;
}

export interface WhatsappHistoryItem {
  id: string;
  patientName: string;
  guardianName: string;
  guardianPhone: string;
  body: string;
  status: "enviado" | "confirmado" | "reagendar_solicitado";
  sentAt: string;
  appointmentDate: string;
  appointmentTime: string;
}

/** Sessões de amanhã ainda sem lembrete D-1 registrado — fila do que falta mandar manualmente. */
export async function getWhatsappQueue(): Promise<WhatsappQueueItem[]> {
  const supabase = await createClient();
  const tomorrow = nextCalendarDay(todayInTimeZone(CLINIC_TIMEZONE));
  const rangeStart = zonedDateTimeToUtc(tomorrow, "00:00", CLINIC_TIMEZONE).toISOString();
  const rangeEnd = zonedDateTimeToUtc(tomorrow, "23:59", CLINIC_TIMEZONE).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `id, patient_id, discipline, starts_at, status,
       patients ( full_name ),
       rooms ( name ),
       guardians:guardians!guardians_patient_id_fkey ( id, full_name, phone, is_financial )`,
    )
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd)
    .in("status", ["agendada", "confirmada"])
    .eq("is_provisional", false)
    .order("starts_at", { ascending: true });

  if (error || !appointments || appointments.length === 0) return [];

  const appointmentIds = appointments.map((a) => a.id);
  const { data: alreadySent } = await supabase
    .from("messages")
    .select("related_appointment_id")
    .eq("channel", "whatsapp")
    .eq("template_key", "lembrete_d1")
    .in("related_appointment_id", appointmentIds);

  const sentSet = new Set((alreadySent ?? []).map((m) => m.related_appointment_id));

  return appointments
    .filter((a) => !sentSet.has(a.id))
    .map((a) => {
      const guardiansList = (a.guardians ?? []) as unknown as
        | { id: string; full_name: string; phone: string; is_financial: boolean }[]
        | null;
      const guardian =
        guardiansList?.find((g) => g.is_financial) ?? guardiansList?.[0] ?? null;

      const startsAt = new Date(a.starts_at);
      const appointmentDate = startsAt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE });
      const appointmentTime = startsAt.toLocaleTimeString("pt-BR", {
        timeZone: CLINIC_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      });
      const patientName = (a.patients as { full_name: string } | null)?.full_name ?? "Paciente";
      const roomName = (a.rooms as { name: string } | null)?.name ?? "sala a confirmar";

      const message = buildD1ReminderMessage({
        guardianName: guardian?.full_name ?? "responsável",
        patientName,
        discipline: a.discipline,
        appointmentDate,
        appointmentTime,
        roomName,
      });

      return {
        appointmentId: a.id,
        patientId: a.patient_id,
        patientName,
        guardianId: guardian?.id ?? null,
        guardianName: guardian?.full_name ?? "Responsável não cadastrado",
        guardianPhone: guardian?.phone ?? null,
        discipline: a.discipline,
        roomName,
        appointmentDate,
        appointmentTime,
        message,
        whatsappLink: guardian?.phone ? buildWhatsappLink(guardian.phone, message) : null,
      };
    });
}

/** Histórico real de lembretes D-1 já registrados (nada de dado fabricado). */
export async function getWhatsappHistory(): Promise<WhatsappHistoryItem[]> {
  const supabase = await createClient();
  const todayStart = zonedDateTimeToUtc(todayInTimeZone(CLINIC_TIMEZONE), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      `id, body, sent_at, template_key,
       patients ( full_name ),
       guardians ( full_name, phone ),
       appointments ( starts_at, status, confirmed_at )`,
    )
    .eq("channel", "whatsapp")
    .gte("sent_at", todayStart)
    .order("sent_at", { ascending: false });

  if (error || !messages) return [];

  return messages.map((m) => {
    const appointment = m.appointments as { starts_at: string; status: string; confirmed_at: string | null } | null;
    let status: WhatsappHistoryItem["status"] = "enviado";
    if (appointment?.status === "confirmada" || appointment?.confirmed_at) {
      status = "confirmado";
    } else if (appointment?.status?.startsWith("cancelada")) {
      status = "reagendar_solicitado";
    }

    const startsAt = appointment?.starts_at ? new Date(appointment.starts_at) : new Date(m.sent_at ?? Date.now());
    return {
      id: m.id,
      patientName: (m.patients as { full_name: string } | null)?.full_name ?? "Paciente",
      guardianName: (m.guardians as { full_name: string } | null)?.full_name ?? "Responsável",
      guardianPhone: (m.guardians as { phone: string } | null)?.phone ?? "—",
      body: m.body ?? "",
      status,
      sentAt: m.sent_at ?? new Date().toISOString(),
      appointmentDate: startsAt.toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
      appointmentTime: startsAt.toLocaleTimeString("pt-BR", {
        timeZone: CLINIC_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
}

/**
 * Registra que a recepção mandou o lembrete pelo WhatsApp próprio (Web/App
 * já logado) depois de clicar no link `wa.me` gerado. Não envia nada — só
 * dá baixa na fila e guarda o texto exato que foi mandado.
 */
export async function logWhatsappSent(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const guardianId = String(formData.get("guardian_id") ?? "") || null;
  const appointmentId = String(formData.get("appointment_id") ?? "") || null;
  const body = String(formData.get("body") ?? "");

  if (!patientId || !body) {
    return { success: false, error: "Dados incompletos para registrar o envio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    patient_id: patientId,
    guardian_id: guardianId,
    channel: "whatsapp",
    direction: "outbound",
    template_key: "lembrete_d1",
    body,
    sent_at: new Date().toISOString(),
    related_appointment_id: appointmentId,
  });

  if (error) {
    return { success: false, error: "Não foi possível registrar o envio. Tente de novo." };
  }

  revalidatePath("/recepcao/whatsapp");
  revalidatePath("/recepcao");
  return { success: true };
}
