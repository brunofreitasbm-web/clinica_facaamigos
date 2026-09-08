"use server";

import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";

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
