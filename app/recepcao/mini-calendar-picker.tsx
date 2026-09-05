"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Cell = { iso: string; day: number; inMonth: boolean };

function buildMonthGrid(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay();
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(Date.UTC(year, month, i - startWeekday + 1));
    cells.push({
      iso: cellDate.toISOString().slice(0, 10),
      day: cellDate.getUTCDate(),
      inMonth: cellDate.getUTCMonth() === month,
    });
  }
  return cells;
}

export function MiniCalendarPicker({
  selectedDate,
  basePath,
}: {
  selectedDate: string;
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, monthStr, ] = selectedDate.split("-");
  const [viewYear, setViewYear] = useState(Number(year));
  const [viewMonth, setViewMonth] = useState(Number(monthStr) - 1);

  function goToMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function pickDay(iso: string) {
    setOpen(false);
    router.push(`${basePath}?date=${iso}`);
  }

  const cells = buildMonthGrid(viewYear, viewMonth);

  return (
    <div className="relative">
      <button
        type="button"
        title="Escolher data"
        onClick={() => {
          if (!open) {
            setViewYear(Number(year));
            setViewMonth(Number(monthStr) - 1);
          }
          setOpen((v) => !v);
        }}
        className="rounded px-2 py-1 opacity-85 hover:bg-white/10 hover:opacity-100"
      >
        <CalendarDays size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-20 mt-2 w-64 rounded-md border border-paper-line-strong bg-paper p-3 text-ink shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => goToMonth(-1)} className="btn btn-icon" style={{ width: 24, height: 24 }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium capitalize">
                {MONTH_PT[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={() => goToMonth(1)} className="btn btn-icon" style={{ width: 24, height: 24 }}>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-ink-faint">
              {WEEKDAY_SHORT_PT.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pickDay(cell.iso)}
                  className={`rounded py-1 text-xs ${
                    cell.iso === selectedDate
                      ? "bg-chart font-semibold text-paper"
                      : cell.inMonth
                        ? "text-ink hover:bg-paper-subtle"
                        : "text-ink-faint hover:bg-paper-subtle"
                  }`}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
