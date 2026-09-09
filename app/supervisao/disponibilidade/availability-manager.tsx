"use client";

import { useRef, useState, useTransition } from "react";
import { addAvailabilityBlock, removeAvailabilityBlock } from "./actions";

export type TherapistOption = { id: string; full_name: string };
export type AvailabilityBlock = {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function formatTime(t: string) {
  return t.slice(0, 5);
}

function TherapistAvailabilityCard({
  therapist,
  blocks,
}: {
  therapist: TherapistOption;
  blocks: AvailabilityBlock[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const blocksByDay = DAY_LABELS.map((_, dayIndex) =>
    blocks.filter((b) => b.day_of_week === dayIndex).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  );

  return (
    <div className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-ink m-0">{therapist.full_name}</h3>

      {blocks.length === 0 ? (
        <p className="text-xs text-ink-faint">
          Nenhuma disponibilidade cadastrada — agendamentos para este terapeuta não são bloqueados por
          horário até que o primeiro bloco seja adicionado.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DAY_LABELS.map((label, dayIndex) =>
            blocksByDay[dayIndex].length === 0 ? null : (
              <div key={dayIndex} className="rounded-md border border-paper-line bg-paper/60 p-2.5">
                <p className="text-[11px] font-bold uppercase text-ink-soft mb-1.5">{label}</p>
                <div className="space-y-1">
                  {blocksByDay[dayIndex].map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-xs text-ink">
                      <span>
                        {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      </span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startTransition(() => void removeAvailabilityBlock(b.id))}
                        className="text-ink-faint hover:text-status-negative-text text-[11px] font-semibold"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <form
        ref={formRef}
        className="flex flex-wrap items-end gap-2 pt-3 border-t border-paper-line"
        action={(formData) => {
          setError(null);
          formData.set("profile_id", therapist.id);
          startTransition(async () => {
            const result = await addAvailabilityBlock(formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            formRef.current?.reset();
          });
        }}
      >
        <div>
          <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">Dia</label>
          <select name="day_of_week" defaultValue="1" className="rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink">
            {DAY_LABELS.map((label, idx) => (
              <option key={idx} value={idx}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">Início</label>
          <input
            type="time"
            name="start_time"
            required
            defaultValue="08:00"
            className="rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">Término</label>
          <input
            type="time"
            name="end_time"
            required
            defaultValue="17:00"
            className="rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink"
          />
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
          {isPending ? "Adicionando…" : "+ Adicionar bloco"}
        </button>
      </form>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}

export function AvailabilityManager({
  therapists,
  blocks,
}: {
  therapists: TherapistOption[];
  blocks: AvailabilityBlock[];
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {therapists.length === 0 ? (
        <p className="text-sm text-ink-faint">Nenhum terapeuta cadastrado ainda.</p>
      ) : (
        therapists.map((t) => (
          <TherapistAvailabilityCard
            key={t.id}
            therapist={t}
            blocks={blocks.filter((b) => b.profile_id === t.id)}
          />
        ))
      )}
    </div>
  );
}
