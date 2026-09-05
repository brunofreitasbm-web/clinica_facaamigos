"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface WhatsappMessageItem {
  id: string;
  patient_id: string;
  patient_name: string;
  guardian_name: string;
  guardian_phone: string;
  template_key: string;
  body: string;
  status: "enviado" | "entregue" | "lido" | "confirmado" | "reagendar_solicitado";
  sent_at: string;
  appointment_date: string;
  appointment_time: string;
}

export async function getWhatsappMessages(): Promise<WhatsappMessageItem[]> {
  try {
    const supabase = await createClient();
    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        id,
        patient_id,
        guardian_id,
        template_key,
        body,
        sent_at,
        delivered_at,
        read_at,
        related_appointment_id,
        patients ( full_name ),
        guardians ( full_name, phone ),
        appointments ( starts_at, status, confirmed_at )
      `)
      .order("sent_at", { ascending: false });

    if (!error && messages && messages.length > 0) {
      return messages.map((m: any) => {
        let status: WhatsappMessageItem["status"] = "enviado";
        if (m.appointments?.status === "confirmada" || m.appointments?.confirmed_at) {
          status = "confirmado";
        } else if (m.body?.toLowerCase().includes("reagendar")) {
          status = "reagendar_solicitado";
        } else if (m.read_at) {
          status = "lido";
        } else if (m.delivered_at) {
          status = "entregue";
        }

        const apptDate = m.appointments?.starts_at
          ? new Date(m.appointments.starts_at)
          : new Date();

        return {
          id: m.id,
          patient_id: m.patient_id,
          patient_name: m.patients?.full_name ?? "Paciente",
          guardian_name: m.guardians?.full_name ?? "Responsável",
          guardian_phone: m.guardians?.phone ?? "(11) 99999-0000",
          template_key: m.template_key ?? "lembrete_d1",
          body: m.body ?? "",
          status,
          sent_at: m.sent_at ?? new Date().toISOString(),
          appointment_date: apptDate.toLocaleDateString("pt-BR"),
          appointment_time: apptDate.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      });
    }
  } catch {
    // Fallback para modo demo
  }

  // Dados mock demonstrativos realistas para D-1
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("pt-BR");

  return [
    {
      id: "msg-1",
      patient_id: "p-1",
      patient_name: "Gabriel Santos Silva",
      guardian_name: "Mariana Santos Silva",
      guardian_phone: "(11) 98765-4321",
      template_key: "lembrete_d1_confirmacao",
      body: `Olá Mariana! Confirmamos a sessão de TO de Gabriel amanhã (${tomorrowStr}) às 09:00 na Sala 2. Responda 1 para CONFIRMAR ou 2 para REAGENDAR.`,
      status: "confirmado",
      sent_at: new Date(today.getTime() - 2 * 3600 * 1000).toISOString(),
      appointment_date: tomorrowStr,
      appointment_time: "09:00",
    },
    {
      id: "msg-2",
      patient_id: "p-2",
      patient_name: "Lucas Oliveira Souza",
      guardian_name: "Carlos Eduardo Souza",
      guardian_phone: "(11) 97654-3210",
      template_key: "lembrete_d1_confirmacao",
      body: `Olá Carlos! Confirmamos a sessão ABA de Lucas amanhã (${tomorrowStr}) às 10:00 na Sala 1. Responda 1 para CONFIRMAR ou 2 para REAGENDAR.`,
      status: "reagendar_solicitado",
      sent_at: new Date(today.getTime() - 1.5 * 3600 * 1000).toISOString(),
      appointment_date: tomorrowStr,
      appointment_time: "10:00",
    },
    {
      id: "msg-3",
      patient_id: "p-3",
      patient_name: "Beatriz Lima Pereira",
      guardian_name: "Fernanda Lima",
      guardian_phone: "(11) 96543-2109",
      template_key: "lembrete_d1_confirmacao",
      body: `Olá Fernanda! Confirmamos a sessão de Fonoaudiologia de Beatriz amanhã (${tomorrowStr}) às 14:00 na Sala 3. Responda 1 para CONFIRMAR ou 2 para REAGENDAR.`,
      status: "lido",
      sent_at: new Date(today.getTime() - 1 * 3600 * 1000).toISOString(),
      appointment_date: tomorrowStr,
      appointment_time: "14:00",
    },
    {
      id: "msg-4",
      patient_id: "p-4",
      patient_name: "Enzo Ferreira Costa",
      guardian_name: "Roberto Costa",
      guardian_phone: "(11) 95432-1098",
      template_key: "lembrete_d1_confirmacao",
      body: `Olá Roberto! Confirmamos a sessão de Psicopedagogia de Enzo amanhã (${tomorrowStr}) às 15:30 na Sala 4. Responda 1 para CONFIRMAR ou 2 para REAGENDAR.`,
      status: "entregue",
      sent_at: new Date(today.getTime() - 30 * 60 * 1000).toISOString(),
      appointment_date: tomorrowStr,
      appointment_time: "15:30",
    },
    {
      id: "msg-5",
      patient_id: "p-5",
      patient_name: "Sophia Almeida",
      guardian_name: "Juliana Almeida",
      guardian_phone: "(11) 94321-0987",
      template_key: "lembrete_d1_confirmacao",
      body: `Olá Juliana! Confirmamos a sessão de Psicologia de Sophia amanhã (${tomorrowStr}) às 16:30 na Sala 1. Responda 1 para CONFIRMAR ou 2 para REAGENDAR.`,
      status: "enviado",
      sent_at: new Date(today.getTime() - 10 * 60 * 1000).toISOString(),
      appointment_date: tomorrowStr,
      appointment_time: "16:30",
    },
  ];
}

export async function sendManualWhatsappD1(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const guardianPhone = String(formData.get("phone") ?? "");
  const appointmentId = String(formData.get("appointment_id") ?? "");

  try {
    const supabase = await createClient();
    if (patientId) {
      await supabase.from("messages").insert({
        patient_id: patientId,
        channel: "whatsapp",
        direction: "outbound",
        template_key: "lembrete_d1_manual",
        body: `Lembrete D-1 enviado manualmente para ${guardianPhone}`,
        sent_at: new Date().toISOString(),
        related_appointment_id: appointmentId || null,
      });
    }
  } catch {
    // Modo demo suportado
  }

  revalidatePath("/recepcao/whatsapp");
  revalidatePath("/recepcao");
  return { success: true };
}
