// app/gestor/integracoes/whatsapp/whatsapp-settings-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

export async function updateWhatsappSettings(formData: FormData): Promise<ActionResult> {
  const botEnabled = formData.get("bot_enabled") === "on";
  const address = String(formData.get("address") ?? "").trim() || null;
  const openingHours = String(formData.get("opening_hours") ?? "").trim() || null;
  const humanContactPhone = String(formData.get("human_contact_phone") ?? "").trim() || null;
  const evaluationSupervisorProfileId = String(formData.get("evaluation_supervisor_profile_id") ?? "").trim() || null;
  const evaluationDurationMinutes = Number(formData.get("evaluation_duration_minutes") ?? 60);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      bot_enabled: botEnabled,
      address,
      opening_hours: openingHours,
      human_contact_phone: humanContactPhone,
      evaluation_supervisor_profile_id: evaluationSupervisorProfileId,
      evaluation_duration_minutes: evaluationDurationMinutes || 60,
    })
    .eq("clinic_id", DEV_CLINIC_ID);

  if (error) {
    return { success: false, error: "Não foi possível salvar as configurações." };
  }

  revalidatePath("/gestor/integracoes/whatsapp");
  return { success: true };
}
