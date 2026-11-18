"use client";

import { useState, useTransition } from "react";
import { sendCoordinationMessage } from "./actions";

/** Campo de resposta dentro do chat interno com a Coordenação (sem WhatsApp, sem modal). A validação mora na action. */
export function ChatComposer({ patientId, guardianId }: { patientId: string; guardianId: string | null }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const r = await sendCoordinationMessage(patientId, guardianId, body);
          if (r.success) {
            setBody("");
            setError(null);
          } else {
            setError(r.error ?? "Não foi possível enviar.");
          }
        });
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Escreva para a Coordenação"
        aria-label="Mensagem para a Coordenação"
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <button type="submit" disabled={pending || body.trim().length < 3} className="btn self-end">
        {pending ? "Enviando…" : "Enviar"}
      </button>
      {error && <p role="alert" className="text-sm m-0" style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}
