"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addAvailabilityBlock,
  clearTherapistAvailability,
  removeAvailabilityBlock,
  replicateDayToWeekdays,
} from "./actions";

export type TherapistOption = { id: string; full_name: string };
export type AvailabilityBlock = {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAYS = [
  { index: 1, label: "Segunda", short: "Seg" },
  { index: 2, label: "Terça", short: "Ter" },
  { index: 3, label: "Quarta", short: "Qua" },
  { index: 4, label: "Quinta", short: "Qui" },
  { index: 5, label: "Sexta", short: "Sex" },
  { index: 6, label: "Sábado", short: "Sáb" },
  { index: 0, label: "Domingo", short: "Dom" },
];

function formatTime(t: string) {
  return t.slice(0, 5);
}

function minutesOf(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Filter = "todos" | "sem" | "com";
type Result = { success: true } | { success: false; error: string };

/**
 * Grade semanal de disponibilidade — uma linha por terapeuta, uma coluna por
 * dia. A tela é de coordenação (supervisão/gestão) e roda no computador da
 * clínica: com dezenas de terapeutas, o formato de um cartão por pessoa
 * obrigava a rolar a página inteira pra comparar dois profissionais no mesmo
 * dia, que é exatamente a pergunta do dia a dia ("quem atende quinta de
 * manhã?"). O terapeuta não edita nada aqui — apenas visualiza sua janela.
 */
export function AvailabilityManager({
  therapists,
  blocks,
}: {
  therapists: TherapistOption[];
  blocks: AvailabilityBlock[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<{ profileId: string; day: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Os últimos horários salvos viram o padrão do próximo bloco: cadastrar a
  // equipe inteira é digitar o mesmo 08:00–17:00 dezenas de vezes.
  const [lastTimes, setLastTimes] = useState({ start: "08:00", end: "17:00" });

  const byTherapist = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>();
    for (const block of blocks) {
      const list = map.get(block.profile_id);
      if (list) list.push(block);
      else map.set(block.profile_id, [block]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [blocks]);

  const rows = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return therapists
      .map((therapist) => {
        const own = byTherapist.get(therapist.id) ?? [];
        const weeklyMinutes = own.reduce(
          (total, b) => total + (minutesOf(b.end_time) - minutesOf(b.start_time)),
          0,
        );
        return { therapist, own, weeklyMinutes };
      })
      .filter(({ therapist, own }) => {
        if (normalizedQuery && !normalize(therapist.full_name).includes(normalizedQuery)) {
          return false;
        }
        if (filter === "sem") return own.length === 0;
        if (filter === "com") return own.length > 0;
        return true;
      });
  }, [therapists, byTherapist, query, filter]);

  const withoutWindow = therapists.filter((t) => (byTherapist.get(t.id) ?? []).length === 0).length;

  function run(action: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
      else setEditing(null);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pb-10 sm:px-10">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-paper-line bg-white px-4 py-3 shadow-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar terapeuta…"
          aria-label="Buscar terapeuta"
          className="input h-10 min-h-0 w-64 py-0 text-sm"
        />
        <div className="seg h-10">
          {(
            [
              ["todos", `Todos (${therapists.length})`],
              ["sem", `Sem janela (${withoutWindow})`],
              ["com", `Com janela (${therapists.length - withoutWindow})`],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="seg-btn min-h-0 py-0 text-xs"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="m-0 ml-auto max-w-md text-xs text-ink-faint">
          Terapeuta sem nenhuma janela cadastrada não é bloqueado por horário — o agendamento só
          passa a ser barrado depois do primeiro bloco.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-md bg-status-negative-soft px-3 py-2 text-xs font-semibold text-status-negative-text"
        >
          {error}
        </p>
      )}

      {therapists.length === 0 ? (
        <p className="text-sm text-ink-faint">Nenhum terapeuta cadastrado ainda.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-faint">Nenhum terapeuta encontrado com esse filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-paper-line bg-white shadow-sm">
          <table className="table min-w-[1180px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-64 bg-paper">Terapeuta</th>
                {DAYS.map((day) => (
                  <th key={day.index} className="w-[135px]">
                    <span className="hidden xl:inline">{day.label}</span>
                    <span className="xl:hidden">{day.short}</span>
                  </th>
                ))}
                <th className="w-24 text-right">Semana</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ therapist, own, weeklyMinutes }) => (
                <tr key={therapist.id} className="align-top">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-3.5 py-3 text-left align-top text-sm font-bold normal-case tracking-normal text-ink"
                  >
                    <div className="flex flex-col gap-1">
                      <span>{therapist.full_name}</span>
                      {own.length === 0 ? (
                        <span className="tag tag-neutral w-fit text-[10px]">sem janela</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Limpar toda a disponibilidade de ${therapist.full_name}?`,
                              )
                            ) {
                              return;
                            }
                            run(() => clearTherapistAvailability(therapist.id));
                          }}
                          className="w-fit text-[11px] font-semibold text-ink-faint hover:text-status-negative-text"
                        >
                          Limpar semana
                        </button>
                      )}
                    </div>
                  </th>

                  {DAYS.map((day) => {
                    const dayBlocks = own.filter((b) => b.day_of_week === day.index);
                    const isEditing =
                      editing?.profileId === therapist.id && editing.day === day.index;

                    return (
                      <td key={day.index} className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          {dayBlocks.map((block) => (
                            <span
                              key={block.id}
                              className="group flex items-center justify-between gap-1 rounded-md bg-chart-soft px-2 py-1 text-[11px] font-semibold tabular-nums text-chart-strong"
                            >
                              {formatTime(block.start_time)}–{formatTime(block.end_time)}
                              <button
                                type="button"
                                disabled={isPending}
                                aria-label={`Remover ${formatTime(block.start_time)} às ${formatTime(
                                  block.end_time,
                                )} de ${day.label} de ${therapist.full_name}`}
                                onClick={() => run(() => removeAvailabilityBlock(block.id))}
                                className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-status-negative-text focus-visible:opacity-100"
                              >
                                ×
                              </button>
                            </span>
                          ))}

                          {isEditing ? (
                            <form
                              className="flex flex-col gap-1 rounded-md border border-paper-line-strong p-1.5"
                              action={(formData) => {
                                const start = String(formData.get("start_time") ?? "");
                                const end = String(formData.get("end_time") ?? "");
                                formData.set("profile_id", therapist.id);
                                formData.set("day_of_week", String(day.index));
                                setLastTimes({ start, end });
                                run(() => addAvailabilityBlock(formData));
                              }}
                            >
                              <input
                                type="time"
                                name="start_time"
                                required
                                autoFocus
                                defaultValue={lastTimes.start}
                                aria-label="Início"
                                className="input h-8 min-h-0 px-2 py-0 text-[11px]"
                              />
                              <input
                                type="time"
                                name="end_time"
                                required
                                defaultValue={lastTimes.end}
                                aria-label="Término"
                                className="input h-8 min-h-0 px-2 py-0 text-[11px]"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="btn btn-primary min-h-0 flex-1 px-2 py-1 text-[11px]"
                                >
                                  {isPending ? "…" : "Salvar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  className="btn min-h-0 px-2 py-1 text-[11px] text-ink-faint"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  setError(null);
                                  setEditing({ profileId: therapist.id, day: day.index });
                                }}
                                className="rounded-md border border-dashed border-paper-line-strong px-2 py-1 text-[11px] font-semibold text-ink-faint hover:border-chart hover:text-chart"
                              >
                                + horário
                              </button>
                              {dayBlocks.length > 0 && (
                                <button
                                  type="button"
                                  disabled={isPending}
                                  title="Repetir esta janela de segunda a sexta (substitui os outros dias úteis)"
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Repetir a janela de ${day.label} em todos os dias úteis de ${therapist.full_name}? Isso substitui o que estiver cadastrado de segunda a sexta.`,
                                      )
                                    ) {
                                      return;
                                    }
                                    run(() => replicateDayToWeekdays(therapist.id, day.index));
                                  }}
                                  className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink-faint hover:text-chart"
                                >
                                  ⇢ seg–sex
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-3.5 py-3 text-right text-sm font-bold tabular-nums text-ink">
                    {weeklyMinutes === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      formatDuration(weeklyMinutes)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
