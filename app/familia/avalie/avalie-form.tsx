"use client";

import { useState, useTransition } from "react";
import { submitFamilyFeedback } from "../actions";
import { FEEDBACK_CATEGORIES, FEEDBACK_RATING_VALUES, FEEDBACK_RATING_LABEL } from "@/lib/family-feedback";

export function AvalieForm({ patientId, guardianId }: { patientId: string; guardianId: string }) {
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <section className="card flex flex-col gap-2">
        <p className="text-sm text-ink">Obrigado pela sua avaliação! Sua opinião ajuda a clínica a melhorar.</p>
        <button type="button" className="btn btn-secondary self-start" onClick={() => { setDone(false); setRatings({}); setComments(""); }}>
          Enviar outra avaliação
        </button>
      </section>
    );
  }

  const hasAnyRating = Object.keys(ratings).length > 0;

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Avalie a clínica</h6>
        <p className="text-sm text-ink-soft">
          Conte pra gente como está sendo sua experiência. Você pode enviar quantas vezes quiser.
        </p>
      </div>

      {FEEDBACK_CATEGORIES.map((cat) => (
        <div className="field" key={cat.key}>
          <label>{cat.label}</label>
          <div className="seg">
            {FEEDBACK_RATING_VALUES.map((value) => (
              <label key={value} className="seg-opt">
                <input
                  type="radio"
                  name={`rating_${cat.key}`}
                  checked={ratings[cat.key] === value}
                  onChange={() => setRatings((prev) => ({ ...prev, [cat.key]: value }))}
                />
                {FEEDBACK_RATING_LABEL[value]}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="field">
        <label>Críticas ou sugestões (opcional)</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Conte com detalhes o que podemos melhorar ou o que gostou..."
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid var(--color-divider)",
            padding: "8px 10px",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

      <button
        type="button"
        className="btn btn-gold self-start"
        disabled={isPending || !hasAnyRating}
        onClick={() => {
          setError(null);
          const formData = new FormData();
          for (const [key, value] of Object.entries(ratings)) {
            formData.set(`rating_${key}`, value);
          }
          formData.set("comments", comments);
          startTransition(async () => {
            const result = await submitFamilyFeedback(patientId, guardianId, formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            setDone(true);
          });
        }}
      >
        {isPending ? "Enviando…" : "Enviar avaliação"}
      </button>
    </section>
  );
}
