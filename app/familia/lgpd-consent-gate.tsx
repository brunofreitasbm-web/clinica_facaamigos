"use client";

import { useTransition } from "react";
import { acceptLgpdConsent } from "./actions";

/**
 * PRD §3.9 — termo de consentimento LGPD exibido antes de qualquer
 * interação, quando ainda não foi assinado (guardians.lgpd_consent_at nulo).
 * Overlay fixo cobrindo a tela inteira: diferente dos dialogs do resto do
 * portal (report-absence.tsx etc.), este não tem botão de fechar sem
 * aceitar — o próprio ponto do gate é bloquear até o aceite.
 */
export function LgpdConsentGate() {
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      await acceptLgpdConsent();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-lg p-6"
        style={{ background: "var(--color-bg)", maxHeight: "85vh", overflowY: "auto" }}
      >
        <h3 style={{ fontFamily: "var(--font-heading)", margin: 0 }}>
          Termo de Consentimento LGPD
        </h3>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-neutral-700)" }}>
          <p>
            A FaçaAmigos trata os dados do seu filho(a) e seus dados de contato exclusivamente
            para prestação do atendimento clínico, comunicação sobre sessões e emissão de
            documentos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
          </p>
          <p>
            Ao aceitar, você autoriza o uso destas informações pela equipe da clínica para essas
            finalidades. Você pode revogar a qualquer momento o consentimento de uso de imagem e
            comunicação na seção &ldquo;Privacidade&rdquo; deste portal, e pode solicitar a
            exclusão ou correção dos dados falando com a recepção.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPending}
          onClick={handleAccept}
        >
          {isPending ? "Registrando…" : "Li e aceito o Termo de Consentimento"}
        </button>
      </div>
    </div>
  );
}
