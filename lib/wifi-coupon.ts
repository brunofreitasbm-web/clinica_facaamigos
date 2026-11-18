import "server-only";
import { createPosAdminClient } from "@/lib/finance-hub/pos-client";

/**
 * Cupons do Portal da Família, emitidos no projeto do PDV (Playground/Circuito) pela Edge Function
 * `wifi-mural-coupon` e usados no caixa de lá. Aqui só pedimos o cupom do responsável logado.
 *
 * Dois tipos (`kind`):
 *  - "mural": ESPERA-XXXX do Wi-Fi (30 dias por responsável, 15 de validade, um benefício por cupom).
 *  - "boas_vindas": BEMVINDO-XXXX do 1º acesso (1 por responsável, 15 dias, só de segunda a quinta, uso único).
 * As regras, e a exclusão mútua (um cupom ativo por responsável), vivem na função, não aqui.
 * Sem POS_SUPABASE_* configuradas, devolvemos "indisponivel" e o Portal segue funcionando.
 */
export type WifiCouponKind = "mural" | "boas_vindas";

export type WifiCoupon =
  | { state: "none" }
  | { state: "indisponivel" }
  /** Só no cupom de boas-vindas: falta o e-mail do responsável (o Portal pede num campo). */
  | { state: "sem_email" }
  | { state: "issued" | "redeemed" | "expired"; kind: WifiCouponKind; code: string; expiresAt: string; nextCouponAt: string };

type Guardian = { id: string; full_name: string; phone: string; email: string | null };

export async function fetchWifiCoupon(
  guardian: Guardian,
  opts: { issue: boolean; kind?: WifiCouponKind; email?: string },
): Promise<WifiCoupon> {
  const kind: WifiCouponKind = opts.kind ?? "mural";
  const pos = createPosAdminClient();
  if (!pos) return { state: "indisponivel" };
  const email = (opts.email ?? guardian.email ?? "").trim();
  // A função exige e-mail. No boas-vindas o Portal pede; no ESPERA a recepção completa o cadastro.
  if (!email) return kind === "boas_vindas" ? { state: "sem_email" } : { state: "indisponivel" };
  const call = (peek: boolean) =>
    pos.functions.invoke("wifi-mural-coupon", {
      body: {
        guardian_id: guardian.id,
        guardian_name: guardian.full_name,
        guardian_phone: guardian.phone,
        guardian_email: email,
        kind,
        peek,
      },
    });

  let data;
  let error;
  if (kind === "boas_vindas") {
    // Versão antiga da função (sem `kind`) ignoraria o pedido de boas-vindas e emitiria um ESPERA-. Para não
    // emitir o cupom errado se este app subir antes da função, quem vai emitir primeiro consulta (peek) e só
    // segue se a resposta trouxer `kind`.
    ({ data, error } = await call(true));
    if (error || !data?.ok || typeof data.kind !== "string") return { state: "indisponivel" };
    if (opts.issue && data.status === "none") {
      ({ data, error } = await call(false));
      if (error || !data?.ok) return { state: "indisponivel" };
    }
  } else {
    ({ data, error } = await call(!opts.issue));
    if (error || !data?.ok) return { state: "indisponivel" };
  }
  if (data.status === "none") return { state: "none" };
  return {
    state: data.status,
    kind: data.kind === "boas_vindas" ? "boas_vindas" : "mural",
    code: data.code,
    expiresAt: data.expires_at,
    nextCouponAt: data.next_coupon_at,
  };
}
