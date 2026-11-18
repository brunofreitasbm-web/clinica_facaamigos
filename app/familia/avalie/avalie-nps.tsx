"use client";

import { useState, useTransition } from "react";
import { submitAvalieNps } from "../actions";
import { GOOGLE_REVIEW_URL } from "@/lib/google-review";

/**
 * 1) NPS de 0 a 10 + comentário opcional; 2) botão "Avaliar no Google" para TODOS, com qualquer nota
 * (mostrar só para nota alta é "review gating", proibido pelo Google). Depois de responder, o botão do Google vira o destaque.
 */
export function AvalieNps({ patientId, alreadyAnswered }: { patientId: string; alreadyAnswered: boolean }) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyAnswered);
  const [pending, start] = useTransition();

  const google = (
    <a
      href={GOOGLE_REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={done ? "btn btn-gold self-start" : "btn btn-secondary self-start"}
    >
      Avaliar no Google
    </a>
  );

  return (
    <section className="card flex flex-col gap-4">
      {done ? (
        <p className="text-sm text-ink m-0">
          {alreadyAnswered ? "Você já respondeu o NPS deste mês. Obrigado!" : "Obrigado pela sua nota!"} Se puder, conte também no Google:
          ajuda outras famílias a nos encontrar.
        </p>
      ) : (
        <>
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">Pesquisa de satisfação</h6>
            <p className="text-sm text-ink-soft m-0 mt-1">
              De 0 a 10, o quanto você recomendaria a FaçaAmigos para outra família?
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                aria-pressed={score === n}
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
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Quer contar mais alguma coisa? (opcional)"
            aria-label="Comentário opcional"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {error && <p role="alert" className="text-sm m-0" style={{ color: "var(--status-falta)" }}>{error}</p>}
          <button
            type="button"
            className="btn btn-gold self-start"
            disabled={pending || score === null}
            onClick={() =>
              start(async () => {
                const r = await submitAvalieNps(patientId, score as number, feedback);
                if (!r.success) {
                  setError(r.error);
                  return;
                }
                setError(null);
                setDone(true);
              })
            }
          >
            {pending ? "Enviando…" : "Enviar nota"}
          </button>
        </>
      )}
      {google}
    </section>
  );
}
