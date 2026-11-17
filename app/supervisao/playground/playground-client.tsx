"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLAYGROUND_UNITS, findPlaygroundUnit } from "@/lib/playground/units";
import { Plus, X } from "lucide-react";
import {
  cancelSeries,
  createSeries,
  extendSeries,
  releaseSeries,
  rescheduleVisit,
  saveLocation,
  updateLocation,
} from "./actions";

type PatientOption = { id: string; full_name: string };
type LocationOption = { id: string; name: string };

const LEVELS = [
  { value: 1, label: "Nível 1 (0 a 18 meses)" },
  { value: 2, label: "Nível 2 (18 a 30 meses)" },
  { value: 3, label: "Nível 3 (30 a 48 meses)" },
];

type VisitDraft = { date: string; time: string; durationMin: number };
const emptyVisit = (): VisitDraft => ({ date: "", time: "", durationMin: 60 });

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ success: true } | { success: false; error: string }>, onDone?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) {
        setError(res.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }
  return { pending, error, run, setError };
}

type LocationRow = { id: string; name: string; pos_unit_id: string };

/** Escolha do playground: o código da unidade vem pronto, sem digitar. */
function LocationForm({
  availableUnitIds,
  initialUnitId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  availableUnitIds: string[];
  initialUnitId?: string;
  submitLabel: string;
  onSubmit: (posUnitId: string) => ReturnType<typeof saveLocation>;
  onCancel?: () => void;
}) {
  const options = PLAYGROUND_UNITS.filter((u) => availableUnitIds.includes(u.posUnitId));
  const [unit, setUnit] = useState(
    initialUnitId && options.some((o) => o.posUnitId === initialUnitId) ? initialUnitId : (options[0]?.posUnitId ?? ""),
  );
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
        Playground
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {options.map((u) => (
            <option key={u.posUnitId} value={u.posUnitId}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || !unit}
          onClick={() => run(() => onSubmit(unit), onCancel)}
        >
          {pending ? "Salvando…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/** Locais do playground: sempre dá para adicionar o que falta e corrigir um local com unidade inválida. */
export function LocationsPanel({ locations }: { locations: LocationRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const registered = new Set(locations.map((l) => l.pos_unit_id));
  const missing = PLAYGROUND_UNITS.filter((u) => !registered.has(u.posUnitId)).map((u) => u.posUnitId);
  const [adding, setAdding] = useState(locations.length === 0);

  return (
    <div className="flex flex-col gap-3">
      {locations.length === 0 && (
        <p className="text-sm text-ink-faint">Cadastre os playgrounds onde as avaliações acontecem. Sem local, não dá para criar avaliações.</p>
      )}
      <ul className="m-0 flex list-none flex-col divide-y p-0" style={{ borderColor: "var(--color-neutral-200)" }}>
        {locations.map((l) => {
          const known = findPlaygroundUnit(l.pos_unit_id);
          const editable = [...missing, ...(known ? [known.posUnitId] : [])];
          return (
            <li key={l.id} className="py-2">
              {editingId === l.id ? (
                <LocationForm
                  availableUnitIds={editable}
                  initialUnitId={known?.posUnitId}
                  submitLabel="Salvar alterações"
                  onSubmit={(u) => updateLocation(l.id, u)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{l.name}</div>
                    {known ? (
                      <div className="text-xs text-ink-faint">Ligado ao PDV</div>
                    ) : (
                      <div className="text-xs font-semibold" style={{ color: "var(--status-falta)" }}>
                        Unidade inválida: o PDV não vai enxergar este local. Escolha o playground certo.
                      </div>
                    )}
                  </div>
                  {known ? null : (
                    <button type="button" className="btn btn-primary" disabled={editable.length === 0} onClick={() => setEditingId(l.id)}>
                      Corrigir
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {missing.length === 0 ? null : adding ? (
        <LocationForm
          availableUnitIds={missing}
          submitLabel="Salvar local"
          onSubmit={(u) => saveLocation(u)}
          onCancel={locations.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        <div>
          <button type="button" className="btn btn-secondary flex items-center gap-2" onClick={() => setAdding(true)}>
            <Plus size={16} /> Adicionar playground
          </button>
        </div>
      )}
    </div>
  );
}

export function NewSeriesDialog({ patients, locations }: { patients: PatientOption[]; locations: LocationOption[] }) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [level, setLevel] = useState(1);
  const [visits, setVisits] = useState<VisitDraft[]>([emptyVisit()]);
  const { pending, error, run, setError } = useAction();

  function update(i: number, patch: Partial<VisitDraft>) {
    setVisits((cur) => cur.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function submit(release: boolean) {
    run(
      () => createSeries({ patientId, locationId, level, visits, release }),
      () => {
        setOpen(false);
        setPatientId("");
        setVisits([emptyVisit()]);
      },
    );
  }

  return (
    <>
      <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
        <Plus size={16} /> Nova avaliação
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0">Nova avaliação no playground</h3>
              <button type="button" aria-label="Fechar" className="btn btn-secondary" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {locations.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Cadastre ao menos um local em &ldquo;Locais do playground&rdquo;, nesta página, antes de criar uma avaliação.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                  Criança
                  <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    <option value="" disabled>
                      Selecione a criança
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                    Local
                    <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
                    Nível do VB-MAPP
                    <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs font-semibold text-ink-faint">Visitas (até 5)</legend>
                  {visits.map((v, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2">
                      <span className="tabular-figure text-xs font-bold text-ink-faint">{i + 1}ª</span>
                      <input type="date" className="input" value={v.date} onChange={(e) => update(i, { date: e.target.value })} />
                      <input type="time" className="input" value={v.time} onChange={(e) => update(i, { time: e.target.value })} />
                      <select
                        className="input"
                        value={v.durationMin}
                        onChange={(e) => update(i, { durationMin: Number(e.target.value) })}
                        aria-label="Duração"
                      >
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                      </select>
                      {visits.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Remover ${i + 1}ª visita`}
                          className="btn btn-secondary"
                          onClick={() => setVisits((cur) => cur.filter((_, idx) => idx !== i))}
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                  {visits.length < 5 && (
                    <div>
                      <button type="button" className="btn btn-secondary" onClick={() => setVisits((cur) => [...cur, emptyVisit()])}>
                        Adicionar visita
                      </button>
                    </div>
                  )}
                </fieldset>

                {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setError(null); submit(false); }}>
                    Salvar rascunho
                  </button>
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={() => submit(true)}>
                    {pending ? "Liberando…" : "Liberar para o playground"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Seletor compacto de data e hora, usado em remarcar e prorrogar. */
function DateTimeInline({
  label,
  onSubmit,
  pending,
}: {
  label: string;
  onSubmit: (date: string, time: string) => void;
  pending: boolean;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
      <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Horário" />
      <button type="button" className="btn btn-primary" disabled={pending || !date || !time} onClick={() => onSubmit(date, time)}>
        {pending ? "Salvando…" : label}
      </button>
    </div>
  );
}

export type RowAction = "reagendar" | "prorrogar" | "liberar" | null;

/** Ação da linha da fila: uma só, a que resolve aquele problema. */
export function QueueRowAction({
  action,
  seriesId,
  visitId,
}: {
  action: RowAction;
  seriesId: string;
  visitId: string | null;
}) {
  const { pending, error, run } = useAction();
  if (!action) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {action === "liberar" && (
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => releaseSeries(seriesId))}>
          {pending ? "Liberando…" : "Liberar para o playground"}
        </button>
      )}
      {action === "reagendar" && visitId && (
        <DateTimeInline label="Remarcar visita" pending={pending} onSubmit={(d, t) => run(() => rescheduleVisit(visitId, d, t))} />
      )}
      {action === "prorrogar" && (
        <DateTimeInline label="Adicionar visita" pending={pending} onSubmit={(d, t) => run(() => extendSeries(seriesId, d, t))} />
      )}
      {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </div>
  );
}

/** Ações secundárias de uma avaliação em andamento. */
export function SeriesRowActions({
  seriesId,
  status,
  canExtend,
}: {
  seriesId: string;
  status: string;
  canExtend: boolean;
}) {
  const { pending, error, run } = useAction();
  const [extending, setExtending] = useState(false);
  if (status !== "rascunho" && status !== "liberada") return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "rascunho" && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => releaseSeries(seriesId))}>
            Liberar
          </button>
        )}
        {status === "liberada" && canExtend && (
          <button type="button" className="btn btn-secondary" onClick={() => setExtending((v) => !v)}>
            Adicionar visita
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Cancelar esta avaliação? As visitas futuras deixam de aparecer no playground.")) {
              run(() => cancelSeries(seriesId));
            }
          }}
        >
          Cancelar
        </button>
      </div>
      {extending && (
        <DateTimeInline
          label="Adicionar"
          pending={pending}
          onSubmit={(d, t) => run(() => extendSeries(seriesId, d, t), () => setExtending(false))}
        />
      )}
      {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
    </div>
  );
}
