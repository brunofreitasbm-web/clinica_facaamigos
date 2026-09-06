"use client";

import { useState, useTransition } from "react";
import { setImageConsent } from "./actions";

/**
 * PRD §3.9 — revogar consentimento de uso de imagem/comunicação bloqueia de
 * fato o envio de fotos/vídeos no mural pelo terapeuta (trigger
 * trg_feed_media_image_consent, 20260906000022) — este toggle só reflete o
 * campo `guardians.image_consent` que o trigger consulta.
 */
export function ImageConsentToggle({ initialConsent }: { initialConsent: boolean }) {
  const [consent, setConsent] = useState(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !consent;
    setError(null);
    startTransition(async () => {
      const result = await setImageConsent(next);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConsent(next);
    });
  }

  return (
    <div className="card flex flex-col gap-2" style={{ marginTop: 10 }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Uso de imagem e comunicação</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            {consent
              ? "A equipe pode compartilhar fotos e vídeos da sessão no mural."
              : "Você revogou o consentimento — a equipe não pode mais enviar fotos/vídeos no mural."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={consent}
          disabled={isPending}
          onClick={toggle}
          style={{
            width: 44,
            height: 26,
            borderRadius: 999,
            border: "none",
            background: consent ? "var(--color-accent-2)" : "var(--color-neutral-300)",
            position: "relative",
            cursor: "pointer",
            flexShrink: 0,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: consent ? 21 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s",
            }}
          />
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}
    </div>
  );
}
