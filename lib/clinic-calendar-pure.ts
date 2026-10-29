// lib/clinic-calendar-pure.ts
// Calendário de funcionamento da clínica, PURO: feriados nacionais (fixos e
// móveis, calculados a partir da Páscoa), fechamentos cadastrados à mão e a
// grade de `clinic_business_hours`. É a mesma regra que a função SQL
// `clinic_is_closed` aplica no banco — a UI usa esta versão pra pintar a
// agenda de cinza, o banco usa a dele pra barrar o insert. Sem import com
// alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/clinic-calendar-pure.test.ts). Datas civis são "YYYY-MM-DD" e
// horários são minutos desde 00:00, sem fuso: quem chama já converteu pra
// CLINIC_TIMEZONE.

export type BusinessHourRow = {
  /** 0 = domingo (extract(dow) do Postgres). */
  day_of_week: number;
  /** `time` do Postgres: "08:00:00". */
  open_time: string;
  close_time: string;
};

export type ClinicClosure = {
  /** "YYYY-MM-DD". */
  date: string;
  /** Minutos desde 00:00; ambos nulos = dia inteiro. */
  start_minutes: number | null;
  end_minutes: number | null;
  reason: string;
};

export type ClinicHoliday = { date: string; name: string };

export type ClosedReason =
  | { kind: "feriado"; label: string }
  | { kind: "fechamento"; label: string }
  | { kind: "fora_expediente"; label: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Soma `days` a uma data civil sem passar por fuso (UTC puro). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = domingo .. 6 = sábado, de uma data civil. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Domingo de Páscoa (calendário gregoriano; algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/**
 * Feriados nacionais obrigatórios + pontos facultativos que a clínica decidiu
 * fechar (Carnaval seg/ter e Corpus Christi). Municipais/estaduais ficam em
 * `clinic_closures` — não dá pra adivinhar por código.
 */
export function brazilHolidays(year: number): ClinicHoliday[] {
  const easter = easterSunday(year);
  return [
    { date: ymd(year, 1, 1), name: "Confraternização Universal" },
    { date: addDays(easter, -48), name: "Carnaval (segunda-feira)" },
    { date: addDays(easter, -47), name: "Carnaval (terça-feira)" },
    { date: addDays(easter, -2), name: "Sexta-feira Santa" },
    { date: ymd(year, 4, 21), name: "Tiradentes" },
    { date: ymd(year, 5, 1), name: "Dia do Trabalho" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
    { date: ymd(year, 9, 7), name: "Independência do Brasil" },
    { date: ymd(year, 10, 12), name: "Nossa Senhora Aparecida" },
    { date: ymd(year, 11, 2), name: "Finados" },
    { date: ymd(year, 11, 15), name: "Proclamação da República" },
    { date: ymd(year, 11, 20), name: "Consciência Negra" },
    { date: ymd(year, 12, 25), name: "Natal" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

export function holidayOn(date: string): ClinicHoliday | null {
  const year = Number(date.slice(0, 4));
  return brazilHolidays(year).find((h) => h.date === date) ?? null;
}

/** "08:00:00" → 480. */
export function timeToMinutes(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
}

export function minutesToHHMM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Só a parte "calendário" da regra: feriado nacional ou fechamento cadastrado
 * que cobre [startMin, endMin). Usada pela UI quando o expediente já é
 * tratado por outra regra (grade com horário de fechamento por dia).
 */
export function closureReason(
  date: string,
  startMin: number,
  endMin: number,
  closures: ClinicClosure[] = [],
): ClosedReason | null {
  const holiday = holidayOn(date);
  if (holiday) return { kind: "feriado", label: holiday.name };

  for (const c of closures) {
    if (c.date !== date) continue;
    const from = c.start_minutes ?? 0;
    const to = c.end_minutes ?? 24 * 60;
    if (startMin < to && endMin > from) return { kind: "fechamento", label: c.reason };
  }
  return null;
}

/**
 * Diz se a clínica está aberta para [startMin, endMin) naquele dia civil, e
 * por que não. Ordem de checagem: feriado → fechamento cadastrado →
 * expediente. Dia sem linha em `businessHours` = fechado (nunca inventa
 * horário — mesmo princípio de formatBusinessHours).
 */
export function closedReason(
  date: string,
  startMin: number,
  endMin: number,
  opts: { businessHours: BusinessHourRow[]; closures?: ClinicClosure[] },
): ClosedReason | null {
  const calendar = closureReason(date, startMin, endMin, opts.closures);
  if (calendar) return calendar;

  const dow = weekdayOf(date);
  const rows = opts.businessHours.filter((r) => r.day_of_week === dow);
  const insideAShift = rows.some(
    (r) => startMin >= timeToMinutes(r.open_time) && endMin <= timeToMinutes(r.close_time),
  );
  if (!insideAShift) return { kind: "fora_expediente", label: "Fora do expediente da clínica" };

  return null;
}

export function isClinicOpen(
  date: string,
  startMin: number,
  endMin: number,
  opts: { businessHours: BusinessHourRow[]; closures?: ClinicClosure[] },
): boolean {
  return closedReason(date, startMin, endMin, opts) === null;
}
