"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMonthlyEntry } from "./actions";
import type { FinUnit, FinMonthlyEntry } from "@/lib/finance-hub/types";

const FIELDS: { key: keyof FinMonthlyEntry; label: string; help?: string }[] = [
  { key: "custos_diretos_manuais", label: "Custos diretos (extra)", help: "custo de produto/serviço não coberto pelo sistema da unidade" },
  { key: "despesas_operacionais_manuais", label: "Despesas operacionais", help: "aluguel, folha, fornecedores etc." },
  { key: "receitas_financeiras", label: "Receitas financeiras", help: "rendimento de aplicação, juros recebidos" },
  { key: "despesas_financeiras", label: "Despesas financeiras", help: "juros pagos, tarifas bancárias" },
  { key: "depreciacao", label: "Depreciação do mês" },
  { key: "impostos", label: "Impostos" },
  { key: "aportes_socios", label: "Aportes de sócios" },
  { key: "retiradas_socios", label: "Retiradas de sócios" },
];

export function MonthlyEntryForm({
  unit,
  competenceMonth,
  entry,
}: {
  unit: FinUnit;
  competenceMonth: string;
  entry: FinMonthlyEntry | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await saveMonthlyEntry(new FormData(e.currentTarget));
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3" style={{ alignItems: "stretch" }}>
      <input type="hidden" name="unitId" value={unit.id} />
      <input type="hidden" name="competenceMonth" value={competenceMonth} />
      <span className="card-kicker">{unit.nome}</span>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label htmlFor={`${unit.id}-${f.key}`}>{f.label}</label>
            <input
              id={`${unit.id}-${f.key}`}
              name={f.key}
              type="number"
              step="0.01"
              className="input"
              defaultValue={entry ? String(entry[f.key] ?? 0) : "0"}
            />
            {f.help && <span style={{ fontSize: 11, opacity: 0.65 }}>{f.help}</span>}
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor={`${unit.id}-ajuste`}>Ajuste manual (qualquer outro item, +/-)</label>
        <input
          id={`${unit.id}-ajuste`}
          name="ajusteManual"
          type="number"
          step="0.01"
          className="input"
          defaultValue={entry ? String(entry.ajuste_manual ?? 0) : "0"}
        />
      </div>
      <div className="field">
        <label htmlFor={`${unit.id}-ajuste-nota`}>Nota do ajuste</label>
        <input
          id={`${unit.id}-ajuste-nota`}
          name="ajusteManualNota"
          type="text"
          className="input"
          defaultValue={entry?.ajuste_manual_nota ?? ""}
          placeholder="explique o que é esse valor"
        />
      </div>
      <div className="field">
        <label htmlFor={`${unit.id}-obs`}>Observações do mês</label>
        <textarea
          id={`${unit.id}-obs`}
          name="observacoes"
          className="input"
          rows={2}
          defaultValue={entry?.observacoes ?? ""}
        />
      </div>

      <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
        <input type="checkbox" name="status" value="fechado" defaultChecked={entry?.status === "fechado"} />
        Fechar o mês (trava novos ajustes acidentais)
      </label>

      {error && <p style={{ color: "var(--status-falta)", fontSize: 13 }}>{error}</p>}
      {saved && <p style={{ color: "var(--color-accent)", fontSize: 13 }}>Salvo.</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
        {loading ? "Salvando…" : "Salvar lançamento do mês"}
      </button>
    </form>
  );
}
