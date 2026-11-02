import "server-only";
import { createPosAdminClient } from "@/lib/finance-hub/pos-client";

/**
 * Cupom ESPERA do Wi-Fi da Clínica, emitido no projeto do PDV (Playground/Circuito) pela Edge Function
 * `wifi-mural-coupon` e usado no caixa de lá. Aqui só pedimos o cupom do responsável logado.
 * Regras (30 dias por responsável, 15 de validade, um benefício por cupom) vivem na função, não aqui.
 * Sem POS_SUPABASE_* configuradas, devolvemos "indisponivel" e o Mural segue funcionando.
 */
export type WifiCoupon =
  | { state: "none" }
  | { state: "indisponivel" }
  | { state: "issued" | "redeemed" | "expired"; code: string; expiresAt: string; nextCouponAt: string };

type Guardian = { id: string; full_name: string; phone: string; email: string | null };

export async function fetchWifiCoupon(guardian: Guardian, opts: { issue: boolean }): Promise<WifiCoupon> {
  const pos = createPosAdminClient();
  if (!pos) return { state: "indisponivel" };
  if (!guardian.email) return { state: "indisponivel" }; // a função exige e-mail; sem ele a recepção completa o cadastro
  const { data, error } = await pos.functions.invoke("wifi-mural-coupon", {
    body: {
      guardian_id: guardian.id,
      guardian_name: guardian.full_name,
      guardian_phone: guardian.phone,
      guardian_email: guardian.email,
      peek: !opts.issue,
    },
  });
  if (error || !data?.ok) return { state: "indisponivel" };
  if (data.status === "none") return { state: "none" };
  return {
    state: data.status,
    code: data.code,
    expiresAt: data.expires_at,
    nextCouponAt: data.next_coupon_at,
  };
}
