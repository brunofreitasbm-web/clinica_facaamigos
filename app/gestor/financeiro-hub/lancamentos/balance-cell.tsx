"use client";

import { useState } from "react";
import { saveBalanceEntry } from "./actions";

/** Um input de saldo (conta × unidade × mês) que salva sozinho ao perder o foco, sem recarregar a tabela inteira. */
export function BalanceCell({
  accountId,
  unitId,
  competenceMonth,
  initialValue,
}: {
  accountId: string;
  unitId: string;
  competenceMonth: string;
  initialValue: number;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleBlur() {
    if (Number(value) === initialValue) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("unitId", unitId);
    fd.set("competenceMonth", competenceMonth);
    fd.set("valor", value || "0");
    const res = await saveBalanceEntry(fd);
    setSaving(false);
    if (res.success) setSavedAt(Date.now());
  }

  return (
    <input
      type="number"
      step="0.01"
      className="input"
      style={{ textAlign: "right", padding: "6px 8px", fontSize: 13, opacity: saving ? 0.6 : 1 }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      title={savedAt ? "Salvo" : undefined}
    />
  );
}
