// lib/invoice-overdue-pure.ts
//
// Faturas de contratos particulares (Gestor > Contratos). A tela só mostrava o mês
// corrente: fatura vencida em mês anterior sumia e ficava sem baixa (CTR-01).

type InvoiceLike = { due_date: string; status: string };

/** "2026-11-14" -> início deste mês e do próximo ("2026-11-01", "2026-12-01"). Datas civis, sem fuso do servidor. */
export function monthBounds(today: string): { monthStart: string; nextMonthStart: string } {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { monthStart, nextMonthStart: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

/** Faturas em aberto (pendente ou atrasada) que venceram antes deste mês, as mais antigas primeiro. */
export function overdueInvoices<T extends InvoiceLike>(invoices: T[], monthStart: string): T[] {
  return invoices
    .filter((i) => i.due_date < monthStart && (i.status === "pendente" || i.status === "atrasado"))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
}

function utcDay(civil: string): number {
  const [y, m, d] = civil.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias de atraso entre duas datas civis AAAA-MM-DD (0 se ainda não venceu). */
export function daysLate(dueDate: string, today: string): number {
  return Math.max(0, Math.round((utcDay(today) - utcDay(dueDate)) / 86_400_000));
}
