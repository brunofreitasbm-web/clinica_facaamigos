"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchWifiCoupon } from "@/lib/wifi-coupon";
import { isAnamneseRealizada } from "@/lib/portal-metodo-pure";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Liberar meu cupom": cupom de boas-vindas (BEMVINDO-) para o responsável que ainda não tem e-mail
 * cadastrado. Quem já tem e-mail recebe o cupom sozinho ao abrir o Portal (ver app/familia/page.tsx).
 * Exige consentimento LGPD e a 1ª Avaliação (anamnese) já realizada. O e-mail só é gravado depois de o
 * cupom ser emitido com sucesso.
 */
export async function claimWelcomeCoupon(patientId: string, rawEmail: string): Promise<{ success: boolean; error?: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { success: false, error: "Digite um e-mail válido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Faça login novamente." };

  // A RLS de guardians/patients/appointments garante que só vem o que é deste responsável.
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name, phone, email, lgpd_consent_at")
    .eq("patient_id", patientId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!guardian) return { success: false, error: "Seu cadastro de responsável não foi encontrado. Fale com a recepção." };
  if (!guardian.lgpd_consent_at) return { success: false, error: "Aceite o termo de privacidade antes de pegar o cupom." };

  const [{ data: patient }, { data: evals }] = await Promise.all([
    supabase.from("patients").select("evaluated_at").eq("id", patientId).maybeSingle(),
    supabase.from("appointments").select("status").eq("patient_id", patientId).eq("is_evaluation", true),
  ]);
  if (!isAnamneseRealizada(patient, (evals ?? []).map((e) => e.status as string))) {
    return { success: false, error: "O cupom é liberado depois da 1ª avaliação." };
  }

  const coupon = await fetchWifiCoupon(guardian, { issue: true, kind: "boas_vindas", email });
  if (coupon.state === "indisponivel" || coupon.state === "sem_email") {
    return { success: false, error: "Não foi possível gerar o cupom agora. Tente de novo ou fale com a recepção." };
  }

  if (!guardian.email) {
    await supabase.from("guardians").update({ email }).eq("id", guardian.id);
  }
  revalidatePath("/familia");
  return { success: true };
}
