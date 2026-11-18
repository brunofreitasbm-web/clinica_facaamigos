"use client";

import { useState, useTransition } from "react";
import { claimWelcomeCoupon } from "./welcome-coupon-actions";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Belem" });
}

/**
 * Cupom de boas-vindas do Portal. Dois estados que aparecem na tela:
 *  - emitido: o código grande e a regra em uma linha (o operador do caixa só digita o código);
 *  - sem e-mail: 1 campo + 1 botão. Usado e vencido não ocupam espaço (voltam a aparecer o cartão do Wi-Fi).
 */
export function WelcomeCouponCard(
  props: { patientId: string } & (
    | { state: "issued"; code: string; expiresAt: string }
    | { state: "sem_email" }
  ),
) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section id="cupom" className="card">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0 mb-2">🎁 Seu cupom de boas-vindas</h6>
      {props.state === "issued" ? (
        <>
          <p style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 900, letterSpacing: ".05em", margin: "4px 0" }}>{props.code}</p>
          <p className="text-sm text-ink m-0">
            Mostre este código no caixa. Playground: ganhe +30 min ao comprar 30 min. Circuito: +10 min no passeio.
            Só na 1ª visita, de segunda a quinta, até {fmt(props.expiresAt)}.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink mb-3">
            Playground: +30 min ao comprar 30 min. Circuito: +10 min no passeio. Informe seu e-mail para liberar o cupom.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await claimWelcomeCoupon(props.patientId, email);
                setError(r.success ? null : (r.error ?? "Erro ao gerar o cupom."));
              });
            }}
          >
            <input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded border px-3 py-2 text-sm"
              aria-label="Seu e-mail"
            />
            <button type="submit" disabled={pending} className="btn">
              {pending ? "Liberando…" : "Liberar meu cupom"}
            </button>
          </form>
          {error && <p role="alert" className="text-sm mt-2" style={{ color: "#b91c1c" }}>{error}</p>}
        </>
      )}
    </section>
  );
}
