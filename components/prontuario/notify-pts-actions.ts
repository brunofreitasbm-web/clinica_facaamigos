"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function notifySupervisorMissingPtsAction(
  patientId: string
): Promise<{ success: boolean; error?: string }> {
  if (!patientId) return { success: false, error: "Paciente inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Sessão expirada. Faça login novamente." };

  // Buscar perfil do usuário solicitante
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const requesterName = profile?.full_name ?? "Profissional da clínica";

  // Buscar paciente
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return { success: false, error: "Paciente não encontrado." };

  // Usar admin client para inserção de notificação
  const admin = createAdminClient();

  // Verificar se já existe notificação pendente (não lida)
  const { data: existing } = await admin
    .from("messages")
    .select("id")
    .eq("patient_id", patientId)
    .eq("template_key", "pts_missing_alert")
    .is("read_at", null)
    .maybeSingle();

  if (existing) {
    return { success: true };
  }

  const body = `⚠️ [PENDÊNCIA DE PTS] O paciente ${patient.full_name} não possui um Plano Terapêutico Singular (PTS) ativo ou válido. Solicitação de elaboração e ativação enviada por ${requesterName}.`;

  const { error: insertErr } = await admin.from("messages").insert({
    patient_id: patientId,
    channel: "portal",
    direction: "inbound",
    template_key: "pts_missing_alert",
    body: body,
    sent_at: new Date().toISOString(),
  });

  if (insertErr) {
    console.error("Erro ao notificar supervisor de falta de PTS:", insertErr);
    return { success: false, error: "Não foi possível enviar a notificação ao supervisor." };
  }

  revalidatePath("/supervisao");
  revalidatePath(`/terapeuta/paciente/${patientId}`);
  revalidatePath(`/recepcao/pacientes/${patientId}`);

  return { success: true };
}

export async function checkHasPendingPtsNotice(patientId: string): Promise<boolean> {
  if (!patientId) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("messages")
      .select("id")
      .eq("patient_id", patientId)
      .eq("template_key", "pts_missing_alert")
      .is("read_at", null)
      .maybeSingle();

    return Boolean(data);
  } catch {
    return false;
  }
}
