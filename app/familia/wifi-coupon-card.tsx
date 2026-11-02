"use client";

import { useState, useTransition } from "react";
import { claimWifiCoupon } from "./wifi-coupon-actions";
import type { WifiCoupon } from "@/lib/wifi-coupon";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Belem" });
}

export function WifiCouponCard({ coupon }: { coupon: WifiCoupon }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (coupon.state === "indisponivel") return null;

  return (
    <section id="cupom" className="card">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0 mb-2">Seu cupom do Wi-Fi</h6>
      {coupon.state === "none" && (
        <>
          <p className="text-sm text-ink mb-3">
            Obrigado por usar o Wi-Fi da clínica! Pegue seu cupom para o Playground (meia inclusiva fixa em R$ 50) ou para o Circuito (compre 20 min e ande 25, compre 30 e ande 35, de segunda a sexta).
          </p>
          <button
            type="button"
            disabled={pending}
            className="btn"
            onClick={() => start(async () => {
              const r = await claimWifiCoupon();
              setError(r.success ? null : (r.error ?? "Erro ao gerar o cupom."));
            })}
          >
            {pending ? "Gerando…" : "Pegar meu cupom"}
          </button>
          {error && <p role="alert" className="text-sm mt-2" style={{ color: "#b91c1c" }}>{error}</p>}
        </>
      )}
      {coupon.state === "issued" && (
        <>
          <p className="text-sm text-ink mb-1">Apresente este código na recepção do Playground ou do Circuito. Vale um único benefício, até {fmt(coupon.expiresAt)}.</p>
          <p style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 900, letterSpacing: ".05em", margin: "6px 0" }}>{coupon.code}</p>
        </>
      )}
      {coupon.state === "redeemed" && (
        <p className="text-sm text-ink">Seu cupom {coupon.code} já foi usado. Você pode pegar outro a partir de {fmt(coupon.nextCouponAt)}.</p>
      )}
      {coupon.state === "expired" && (
        <p className="text-sm text-ink">Seu cupom {coupon.code} venceu em {fmt(coupon.expiresAt)}. Você pode pegar outro a partir de {fmt(coupon.nextCouponAt)}.</p>
      )}
    </section>
  );
}
