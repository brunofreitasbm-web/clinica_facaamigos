/**
 * Formatadores compartilhados que toleram valor nulo/inválido — sem isso,
 * `new Date(iso).toLocaleDateString()`/`toLocaleString()` lança RangeError
 * durante o render, causando o React error #441 (hidratação abortada).
 * Ver commits 4580187 e edd04f3.
 */

export function fmtDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone });
}

export function fmtDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { timeZone });
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
