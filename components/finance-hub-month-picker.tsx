"use client";

import { useRouter } from "next/navigation";

/** Seletor de mês de competência — troca `?mes=YYYY-MM` na URL atual e o Server Component recarrega os dados. */
export function FinanceHubMonthPicker({ basePath, mes }: { basePath: string; mes: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      className="input"
      style={{ maxWidth: 180 }}
      value={mes}
      onChange={(e) => {
        if (e.target.value) router.push(`${basePath}?mes=${e.target.value}`);
      }}
      aria-label="Mês de competência"
    />
  );
}
