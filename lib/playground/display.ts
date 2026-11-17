/**
 * Texto mostrado na lista do tablet (ambiente aberto): primeiro nome, idade e
 * horário. A inicial do sobrenome só entra quando há homônimo no mesmo
 * horário. O nome completo nunca sai da clínica.
 */

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

export interface DisplayNameInput {
  id: string;
  fullName: string;
  /** Início da visita (ISO). Homônimos só colidem no mesmo horário. */
  scheduledStart: string;
}

/** Mapa id -> rótulo ("Ana" ou "Ana C." quando há homônimo no mesmo horário). */
export function buildDisplayNames(items: DisplayNameInput[]): Map<string, string> {
  const result = new Map<string, string>();
  const groups = new Map<string, DisplayNameInput[]>();

  for (const item of items) {
    const first = normalize(item.fullName.split(/\s+/)[0] ?? "");
    const key = `${first}|${item.scheduledStart}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  for (const group of groups.values()) {
    for (const item of group) {
      const parts = item.fullName.trim().split(/\s+/);
      const first = capitalize(parts[0] ?? "");
      if (group.length > 1 && parts.length > 1) {
        const lastInitial = (parts[parts.length - 1] ?? "").charAt(0).toUpperCase();
        result.set(item.id, `${first} ${lastInitial}.`);
      } else {
        result.set(item.id, first);
      }
    }
  }
  return result;
}

/** "6 anos" ou "1 ano e 8 meses"/"8 meses" para menores de 2 anos. */
export function ageLabel(birthDate: string, today: string): string {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return "";
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) return "";
  const years = Math.floor(months / 12);
  if (years >= 2) return `${years} anos`;
  const rest = months % 12;
  if (years === 1) return rest > 0 ? `1 ano e ${rest} ${rest === 1 ? "mês" : "meses"}` : "1 ano";
  return `${rest} ${rest === 1 ? "mês" : "meses"}`;
}
