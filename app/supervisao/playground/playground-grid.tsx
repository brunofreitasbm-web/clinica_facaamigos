"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { PLAYGROUND_BLOCKS, PLAYGROUND_UNIT_TONE, blockForTime, capacityMessage, type PlaygroundBlock } from "@/lib/playground/grid";
import { NewSeriesDialog, type SeriesPreset } from "./playground-client";

export type GridUnit = { locationId: string; posUnitId: string; name: string };
export type GridVisit = { locationId: string; time: string; patientName: string };

type Props = {
  day: string;
  dayLabel: string;
  prevDay: string;
  nextDay: string;
  isToday: boolean;
  units: GridUnit[];
  visits: GridVisit[];
  patients: { id: string; full_name: string }[];
  locations: { id: string; name: string }[];
};

/** Dois quadros 50/50 (um por playground), com turnos fechados de 2h. Clicar no turno já abre o agendamento preenchido. */
export function PlaygroundGrid({ day, dayLabel, prevDay, nextDay, isToday, units, visits, patients, locations }: Props) {
  const [preset, setPreset] = useState<SeriesPreset | null>(null);

  function pick(unit: GridUnit, block: PlaygroundBlock, count: number) {
    setPreset({ locationId: unit.locationId, date: day, time: block.start, warning: capacityMessage(count + 1) ?? undefined });
  }

  return (
    <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0">Agenda do dia</h3>
        <div className="flex items-center gap-2">
          <Link href={`?dia=${prevDay}`} className="btn btn-secondary" aria-label="Dia anterior">
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-40 text-center text-sm font-semibold">
            {isToday ? "Hoje · " : ""}
            {dayLabel}
          </span>
          <Link href={`?dia=${nextDay}`} className="btn btn-secondary" aria-label="Próximo dia">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {units.map((unit) => {
          const tone = PLAYGROUND_UNIT_TONE[unit.posUnitId];
          const own = visits.filter((v) => v.locationId === unit.locationId);
          const outside = own.filter((v) => !blockForTime(v.time));
          return (
            <div
              key={unit.locationId}
              className="flex flex-col gap-3 rounded-xl border-2 p-4"
              style={{ background: tone?.bg, borderColor: tone?.border }}
            >
              <h4 className="m-0" style={{ color: tone?.text }}>
                {unit.name}
              </h4>
              {PLAYGROUND_BLOCKS.map((block) => {
                const inBlock = own.filter((v) => blockForTime(v.time)?.start === block.start);
                const warn = capacityMessage(inBlock.length);
                return (
                  <div key={block.start} className="rounded-lg bg-white p-3" style={{ border: `1px solid ${tone?.border}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: tone?.text }}>
                        {block.label}
                      </span>
                      <span className="tabular-figure text-xs text-ink-faint">{inBlock.length} crianças</span>
                    </div>
                    {inBlock.length > 0 && (
                      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-sm">
                        {inBlock.map((v, i) => (
                          <li key={i}>{v.patientName}</li>
                        ))}
                      </ul>
                    )}
                    {warn && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--status-falta)" }}>
                        <TriangleAlert size={14} /> {warn}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary mt-2 flex items-center gap-1"
                      onClick={() => pick(unit, block, inBlock.length)}
                    >
                      <Plus size={14} /> Agendar neste turno
                    </button>
                  </div>
                );
              })}
              {outside.length > 0 && (
                <p className="m-0 text-xs text-ink-faint">
                  Fora dos turnos: {outside.map((v) => `${v.time} ${v.patientName}`).join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {preset && (
        <NewSeriesDialog
          key={`${preset.locationId}-${preset.time}`}
          patients={patients}
          locations={locations}
          preset={preset}
          onClose={() => setPreset(null)}
          hideTrigger
        />
      )}
    </section>
  );
}
