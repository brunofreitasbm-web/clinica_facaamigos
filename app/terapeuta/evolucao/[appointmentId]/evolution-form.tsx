"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionNote } from "../actions";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";

const PRESENCE_SCALE = [1, 2, 3, 4, 5] as const;

export function EvolutionForm({ appointmentId }: { appointmentId: string }) {
  const [presence, setPresence] = useState<number | null>(null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleBehavior(value: string) {
    setSelectedBehaviors((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      action={(formData) => {
        setError(null);
        formData.set("created_at_device", new Date().toISOString());
        if (presence !== null) {
          formData.set("presenca_engajamento", String(presence));
        }
        startTransition(async () => {
          const result = await createSessionNote(appointmentId, formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          router.push("/terapeuta");
        });
      }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Presença e engajamento
        </p>
        <div className="mt-2 flex gap-2">
          {PRESENCE_SCALE.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPresence(n)}
              className={`h-10 w-10 rounded-md border text-sm font-medium ${
                presence === n
                  ? "border-chart bg-chart text-paper"
                  : "border-paper-line-strong bg-paper text-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Comportamentos-alvo observados
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {BEHAVIOR_TYPES.map((b) => (
            <div key={b.value} className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="comportamento_tipo"
                  value={b.value}
                  checked={!!selectedBehaviors[b.value]}
                  onChange={() => toggleBehavior(b.value)}
                />
                {b.label}
              </label>
              {selectedBehaviors[b.value] && (
                <select
                  name={`comportamento_intensidade_${b.value}`}
                  defaultValue="leve"
                  className="rounded-md border border-paper-line-strong bg-paper px-2 py-1 text-xs"
                >
                  {BEHAVIOR_INTENSITIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Orientação dada à família
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FAMILY_GUIDANCE_OPTIONS.map((g) => (
            <label
              key={g.value}
              className="flex items-center gap-2 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
            >
              <input type="checkbox" name="orientacao" value={g.value} />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          className="text-xs font-medium uppercase tracking-wide text-ink-soft"
          htmlFor="free_text"
        >
          Texto livre (opcional)
        </label>
        <textarea
          id="free_text"
          name="free_text"
          rows={3}
          className="mt-2 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Confirmar e assinar"}
      </button>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
