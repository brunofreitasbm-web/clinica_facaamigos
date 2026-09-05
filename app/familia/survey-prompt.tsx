"use client";

import { useState, useTransition } from "react";
import { submitSurvey } from "./actions";

const NPS_SCALE = Array.from({ length: 11 }, (_, i) => i);
const RATING_OPTIONS = [
  { value: "ruim", label: "Ruim" },
  { value: "regular", label: "Regular" },
  { value: "bom", label: "Bom" },
  { value: "otimo", label: "Ótimo" },
] as const;

export function SurveyPrompt({ patientId, guardianId }: { patientId: string; guardianId: string }) {
  const [nps, setNps] = useState<number | null>(null);
  const [recepcaoRating, setRecepcaoRating] = useState("");
  const [terapeutaRating, setTerapeutaRating] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <section className="card">
        <p className="text-sm text-ink">Obrigado por responder! Sua opinião ajuda a clínica a melhorar.</p>
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Pesquisa trimestral</h6>
        <p className="text-sm text-ink-soft">
          Em uma escala de 0 a 10, o quanto você recomendaria a clínica para outra família?
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {NPS_SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNps(n)}
            className="flex items-center justify-center text-sm font-semibold"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${nps === n ? "var(--color-accent)" : "var(--color-divider)"}`,
              background: nps === n ? "var(--color-accent)" : "transparent",
              color: nps === n ? "#fff" : "var(--color-text)",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Como você avalia a recepção?</label>
        <div className="seg">
          {RATING_OPTIONS.map((r) => (
            <label key={r.value} className="seg-opt">
              <input
                type="radio"
                name="recepcao_rating"
                checked={recepcaoRating === r.value}
                onChange={() => setRecepcaoRating(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Como você avalia o(a) terapeuta?</label>
        <div className="seg">
          {RATING_OPTIONS.map((r) => (
            <label key={r.value} className="seg-opt">
              <input
                type="radio"
                name="terapeuta_rating"
                checked={terapeutaRating === r.value}
                onChange={() => setTerapeutaRating(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

      <button
        type="button"
        className="btn btn-gold self-start"
        disabled={isPending || nps === null || !recepcaoRating || !terapeutaRating}
        onClick={() => {
          setError(null);
          const formData = new FormData();
          formData.set("nps_score", String(nps));
          formData.set("recepcao_rating", recepcaoRating);
          formData.set("terapeuta_rating", terapeutaRating);
          startTransition(async () => {
            const result = await submitSurvey(patientId, guardianId, formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            setDone(true);
          });
        }}
      >
        {isPending ? "Enviando…" : "Enviar resposta"}
      </button>
    </section>
  );
}
