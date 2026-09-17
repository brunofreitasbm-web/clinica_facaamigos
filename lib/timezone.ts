/**
 * Conversão de data/hora civil da clínica (`CLINIC_TIMEZONE`, ver
 * lib/constants.ts) para o instante UTC correspondente, sem depender de
 * bibliotecas externas (date-fns-tz/luxon) nem do fuso do processo Node.
 *
 * Estratégia: monta a hora "de parede" como se fosse UTC, descobre o offset
 * real do fuso alvo pra esse instante aproximado via Intl.DateTimeFormat, e
 * corrige. Funciona corretamente em qualquer TZ do processo (dev local ou
 * produção em UTC na Vercel) e mesmo com DST, pois o offset é recalculado
 * pra cada instante.
 */

function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtcMillis = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  // Se o "wall time" no fuso alvo, tratado como UTC, é anterior ao instante
  // real, o fuso está atrás de UTC (offset negativo), e vice-versa.
  return (asUtcMillis - instant.getTime()) / 60_000;
}

/**
 * Converte uma data (`YYYY-MM-DD`) e hora (`HH:mm`) civis no fuso `timeZone`
 * pro instante UTC correspondente.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const guessUtcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = timeZoneOffsetMinutes(new Date(guessUtcMillis), timeZone);
  return new Date(guessUtcMillis - offsetMinutes * 60_000);
}

/** Data civil (`YYYY-MM-DD`) de um instante qualquer, no fuso `timeZone`. */
export function civilDateInTimeZone(instant: Date, timeZone: string): string {
  if (!instant || isNaN(instant.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return "";
  }
}

/** Data civil de "hoje" (`YYYY-MM-DD`) no fuso `timeZone`. */
export function todayInTimeZone(timeZone: string): string {
  return civilDateInTimeZone(new Date(), timeZone);
}

/** `YYYY-MM-DD` do dia civil seguinte, sem passar por fuso — aritmética de calendário pura. */
export function nextCalendarDay(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` do dia civil anterior, sem passar por fuso — aritmética de calendário pura. */
export function previousCalendarDay(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1));
  return prev.toISOString().slice(0, 10);
}

/** Hora:minuto civil (`HH:mm`) de um instante ISO, no fuso `timeZone`. */
export function civilTimeInTimeZone(isoInstant: string, timeZone: string): string {
  if (!isoInstant) return "";
  try {
    const d = new Date(isoInstant);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "";
  }
}

/** Dia da semana civil (0=Dom..6=Sáb) de um instante ISO, no fuso `timeZone`. */
export function weekdayInTimeZone(isoInstant: string, timeZone: string): number {
  const civilDate = civilDateInTimeZone(new Date(isoInstant), timeZone);
  if (!civilDate) return 0;
  const [year, month, day] = civilDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Início (inclusive) e fim (exclusivo, meia-noite do 1º dia do mês
 * seguinte) de um mês civil (`monthStr` no formato `YYYY-MM`) no fuso
 * `timeZone`, como instantes ISO em UTC. Usado pela ficha mensal de
 * presença (FASE 6 — ver app/recepcao/pacientes/[id]/ficha-presenca/pdf/
 * route.ts) para alimentar a RPC `monthly_presence_sheet(p_month_start,
 * p_month_end)` sem depender do fuso do processo Node.
 */
export function monthRangeInTimeZone(monthStr: string, timeZone: string): { startIso: string; endIso: string } {
  const [year, month] = monthStr.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const start = zonedDateTimeToUtc(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`, "00:00", timeZone);
  const end = zonedDateTimeToUtc(`${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`, "00:00", timeZone);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Hora civil (0-23) de um instante ISO, no fuso `timeZone`. */
export function hourInTimeZone(isoInstant: string, timeZone: string): number {
  if (!isoInstant) return 0;
  try {
    const d = new Date(isoInstant);
    if (isNaN(d.getTime())) return 0;
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(d);
    // Intl pode retornar "24" pra meia-noite em alguns runtimes; normalizar.
    const hour = Number(formatted);
    return hour === 24 ? 0 : hour;
  } catch {
    return 0;
  }
}
