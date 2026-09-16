/**
 * Datas de nascimento chegam como `yyyy-mm-dd` puro. `new Date("1990-05-10")`
 * interpretaria isso como UTC e, em fuso negativo (Brasil), voltaria 09/05 —
 * por isso o parse é manual, campo a campo.
 */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatBirthday(iso: string | null): string {
  if (!iso) return "—";
  const parsed = parseIsoDate(iso);
  if (!parsed) return "—";
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}`;
}

export function birthdayAge(iso: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  let age = today.getFullYear() - parsed.year;
  const beforeBirthday =
    today.getMonth() + 1 < parsed.month ||
    (today.getMonth() + 1 === parsed.month && today.getDate() < parsed.day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function isBirthdayThisMonth(iso: string | null, today = new Date()): boolean {
  const parsed = iso ? parseIsoDate(iso) : null;
  return !!parsed && parsed.month === today.getMonth() + 1;
}

export function isBirthdayToday(iso: string | null, today = new Date()): boolean {
  const parsed = iso ? parseIsoDate(iso) : null;
  return !!parsed && parsed.month === today.getMonth() + 1 && parsed.day === today.getDate();
}
