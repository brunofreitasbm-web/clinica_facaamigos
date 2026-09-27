/** "YYYY-MM" do mês atual, e resolução do parâmetro ?mes= com fallback seguro. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function resolveMonthParam(mes: string | string[] | undefined): string {
  const value = Array.isArray(mes) ? mes[0] : mes;
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  return currentMonthKey();
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
