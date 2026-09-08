// Aritmética de calendário civil (`YYYY-MM-DD`), sem fuso — usada por telas
// que precisam de visão semana/mês (hoje: app/terapeuta/agenda). Antes desta
// extração, a mesma matemática estava triplicada: app/supervisao/grade-data.ts
// (Seg–Sex), app/supervisao/evaluation-calendar.tsx (Seg–Sáb) e
// app/recepcao/mini-calendar-picker.tsx (grade de mês, sem export). Aqui é
// Seg–Sáb, não Seg–Sex: a clínica atende sábado de manhã (ver
// CLOSING_HOUR_BY_DAY em app/supervisao/evaluation-calendar.tsx).
// grade-data.ts continua Seg–Sex de propósito — é a semana de trabalho da
// supervisão, não a semana de atendimento; não convergir os dois.
//
// Conversão de fuso (civil <-> instante) continua em lib/timezone.ts — este
// arquivo não sabe o que é `America/Sao_Paulo`, só sabe somar dias de
// calendário.

/** `YYYY-MM-DD` + `n` dias corridos (pode ser negativo). */
export function addCalendarDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + n));
  return next.toISOString().slice(0, 10);
}

/** Segunda-feira (`YYYY-MM-DD`) da semana civil que contém `dateStr`. */
export function mondayOf(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay(); // 0=dom..6=sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateStr, diffToMonday);
}

/** "8 set" — data curta em português, sem hora, sem fuso (formatada em UTC). */
export function shortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export type WeekGrid = {
  /** `YYYY-MM-DD` de Segunda a Sábado (6 dias) da semana que contém `anchor`. */
  days: string[];
  rangeLabel: string;
};

/** Semana civil Seg–Sáb que contém `anchor` (`YYYY-MM-DD`). */
export function buildWeek(anchor: string): WeekGrid {
  const monday = mondayOf(anchor);
  const days = Array.from({ length: 6 }, (_, i) => addCalendarDays(monday, i));
  return { days, rangeLabel: `${shortDate(days[0])} – ${shortDate(days[5])}` };
}

/** Início (Seg 00:00) e fim exclusivo (Dom 00:00) da semana, em `YYYY-MM-DD`. */
export function weekBounds(week: WeekGrid): { start: string; end: string } {
  return { start: week.days[0], end: addCalendarDays(week.days[5], 1) };
}

export type MonthCell = { iso: string; day: number; inMonth: boolean };

export type MonthGrid = {
  /** Sempre 42 células (6 semanas Seg–Dom) — inclui transbordo do mês anterior/seguinte. */
  cells: MonthCell[];
  monthLabel: string;
};

const MONTH_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Grade de 42 células (6 semanas, Seg–Dom) do mês civil que contém `anchor`.
 * Deliberadamente 42 células fixas (não "1º ao último dia do mês"): o range
 * de busca de app/terapeuta/agenda usa exatamente esta janela, então as
 * células de transbordo mostram contagem real em vez de aparentar vazias.
 */
export function buildMonthGrid(anchor: string): MonthGrid {
  const [year, month] = anchor.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = first.getUTCDay(); // 0=dom..6=sáb
  const offsetToMonday = startWeekday === 0 ? -6 : 1 - startWeekday;
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(Date.UTC(year, month - 1, 1 + offsetToMonday + i));
    cells.push({
      iso: cellDate.toISOString().slice(0, 10),
      day: cellDate.getUTCDate(),
      inMonth: cellDate.getUTCMonth() === month - 1,
    });
  }
  return { cells, monthLabel: `${MONTH_PT[month - 1]} de ${year}` };
}

/** Início (1º 00:00) e fim exclusivo (42ª célula + 1 dia) da grade de mês, em `YYYY-MM-DD`. */
export function monthGridBounds(grid: MonthGrid): { start: string; end: string } {
  const last = grid.cells[grid.cells.length - 1].iso;
  return { start: grid.cells[0].iso, end: addCalendarDays(last, 1) };
}
