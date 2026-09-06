"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateAlertStatus(npsSurveyId: string, status: "ok" | "pending_contact" | "em_atendimento" | "resolvido") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("nps_surveys")
    .update({
      alert_status: status,
      alert_updated_by: user?.id ?? null,
      alert_updated_at: new Date().toISOString(),
    })
    .eq("id", npsSurveyId);

  if (error) return { success: false as const, error: error.message };
  revalidatePath("/gestor/nps");
  return { success: true as const };
}
