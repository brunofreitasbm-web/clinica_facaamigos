"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchWifiCoupon } from "@/lib/wifi-coupon";

/** "Pegar meu cupom": só o responsável logado, e só para o vínculo dele (a RLS de guardians filtra). */
export async function claimWifiCoupon(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Faça login novamente." };

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name, phone, email, lgpd_consent_at")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!guardian) return { success: false, error: "Seu cadastro de responsável não foi encontrado. Fale com a recepção." };
  if (!guardian.lgpd_consent_at) return { success: false, error: "Aceite o termo de privacidade antes de pegar o cupom." };

  const coupon = await fetchWifiCoupon(guardian, { issue: true });
  if (coupon.state === "indisponivel") {
    return { success: false, error: "Não foi possível gerar o cupom agora. Tente de novo ou fale com a recepção." };
  }
  revalidatePath("/familia");
  return { success: true };
}
