"use client";

import { useState } from "react";
import type { AttendanceManualOutcome } from "@/lib/conversation-attendance";

const OUTCOME_OPTIONS: { value: AttendanceManualOutcome; label: string }[] = [
  { value: "agendado", label: "Agendou" },
  { value: "resolvido", label: "Dúvida resolvida" },
  { value: "perdido", label: "Não quis seguir" },
  { value: "spam", label: "Spam / engano" },
];

export function CloseDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (outcome: AttendanceManualOutcome, note: string) => Promise<void> | void;
}) {
  const [outcome, setOutcome] = useState<AttendanceManualOutcome | null>(null);
  const [note, setNote] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    if (!outcome || isPending) return;
    setIsPending(true);
    try {
      await onConfirm(outcome, note);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "color-mix(in srgb, var(--color-neutral-900) 55%, transparent)" }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-3 bg-white"
        style={{ borderRadius: "24px 24px 0 0", padding: "14px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
      >
        <div className="mx-auto" style={{ width: 40, height: 5, borderRadius: 9999, background: "var(--color-neutral-300)" }} />

        <h2 className="text-[20px] font-extrabold" style={{ color: "var(--color-text)" }}>
          Encerrar atendimento deste contato?
        </h2>
        <p className="text-[14px]" style={{ color: "var(--color-ink-faint)" }}>
          A conversa vai para <strong>Encerradas</strong> e o bot volta a responder novas mensagens.
        </p>

        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold" style={{ color: "var(--color-text)" }}>
            Como terminou o atendimento?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOME_OPTIONS.map((option) => {
              const active = outcome === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOutcome(option.value)}
                  className="flex items-center gap-2 rounded-[14px] px-3 text-left text-[14px] font-bold"
                  style={{
                    minHeight: 48,
                    border: `1.5px solid ${active ? "var(--color-accent)" : "var(--color-neutral-300)"}`,
                    background: active ? "var(--color-accent-100)" : "transparent",
                    color: active ? "var(--color-accent-700)" : "var(--color-text)",
                  }}
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{ border: `2px solid ${active ? "var(--color-accent)" : "var(--color-neutral-300)"}` }}
                  >
                    {active && <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-accent)" }} />}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Observação (opcional)"
            aria-label="Observação sobre o desfecho"
            className="input mt-2 w-full"
            style={{ borderRadius: 14 }}
          />
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-full px-5 font-bold text-white"
            style={{ minHeight: 48, background: "var(--color-error)", opacity: outcome ? 1 : 0.55 }}
            disabled={!outcome || isPending}
            onClick={handleConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
