/**
 * Formatadores compartilhados que toleram valor nulo/inválido — sem isso,
 * `new Date(iso).toLocaleDateString()`/`toLocaleString()` lança RangeError
 * durante o render. Essas guardas são boas por si só, mas NÃO são a causa
 * do "Minified React error #441" que já apareceu nesta tela: 441 é o
 * placeholder genérico que o React usa em produção para "algo lançou
 * durante o render de um Server Component" (ver
 * react-server-dom-webpack-client, `resolveErrorProd`) — não indica nada
 * sobre datas. A causa real de um #441 na ficha do paciente era uma função
 * comum sendo passada como prop de Server Component para Client Component,
 * corrigida em app/recepcao/pacientes/[id]/page.tsx e
 * components/intake-checklist.tsx. Ver instrumentation.ts (onRequestError)
 * para descobrir a causa real do próximo #441, em vez de assumir que é isto.
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

/**
 * Formatador padronizado de data no formato dd/MM/yyyy com 4 dígitos no ano.
 * Evita inconsitências visuais como 07/11/26 vs 07/11/2026.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";

  // Se já estiver no formato YYYY-MM-DD
  const plainParts = dateStr.split("T")[0].split("-");
  if (plainParts.length === 3 && plainParts[0].length === 4) {
    const [year, month, day] = plainParts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";

  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

