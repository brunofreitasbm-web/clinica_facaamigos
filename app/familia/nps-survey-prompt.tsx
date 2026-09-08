"use client";

import { useState, useTransition } from "react";
import { submitNpsResponse } from "./actions";

/**
 * NPS Externo (evento/mensal) respondido no portal — nunca mais via
 * WhatsApp (ver 20260908030000_nps_externo_portal_only.sql). A escala muda
 * conforme trigger_type: disparos por evento (evaluation/devolutiva) usam
 * 1-5, o disparo mensal usa 0-10 (mesma regra que antes vivia no webhook do
 * Twilio, agora em submit_nps_response).
 */
export function NpsSurveyPrompt({ surveyId, triggerType }: { surveyId: string; triggerType: string }) {
  const isMensal = triggerType === "mensal";
  const scale = Array.from({ length: isMensal ? 11 : 5 }, (_, i) => (isMensal ? i : i + 1));

  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
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
        <h6 style={{ color: "var(--color-accent-2-600)" }}>Pesquisa de satisfação</h6>
        <p className="text-sm text-ink-soft">
          {isMensal
            ? "Numa escala de 0 a 10, o quanto você recomendaria a Clínica Faça Amigos para outra família?"
            : "Como foi seu atendimento com a equipe de supervisão? Dê uma nota de 1 (Insatisfeito) a 5 (Excelente)."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {scale.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className="flex items-center justify-center text-sm font-semibold"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: `1px solid ${score === n ? "var(--color-accent)" : "var(--color-divider)"}`,
              background: score === n ? "var(--color-accent)" : "transparent",
              color: score === n ? "#fff" : "var(--color-text)",
            }}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Quer contar mais alguma coisa? (opcional)</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Escreva aqui, se quiser."
        />
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

      <button
        type="button"
        className="btn btn-gold self-start"
        disabled={isPending || score === null}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await submitNpsResponse(surveyId, score as number, feedback);
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
