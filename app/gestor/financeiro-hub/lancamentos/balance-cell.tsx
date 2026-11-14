"use client";

import { useState } from "react";
import { saveBalanceEntry } from "./actions";
import { shouldSaveBalance } from "@/lib/balance-cell-pure";

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
  const [lastSaved, setLastSaved] = useState(initialValue);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleBlur() {
    if (!shouldSaveBalance(value, lastSaved)) return;
    setState("saving");
    setError(null);
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("unitId", unitId);
    fd.set("competenceMonth", competenceMonth);
    fd.set("valor", value || "0");
    const res = await saveBalanceEntry(fd);
    if (res.success) {
      setLastSaved(Number(value || "0"));
      setState("saved");
    } else {
      setError(res.error);
      setState("error");
    }
  }

  return (
    <div>
      <input
        type="number"
        step="0.01"
        className="input"
        style={{
          textAlign: "right",
          padding: "6px 8px",
          fontSize: 13,
          opacity: state === "saving" ? 0.6 : 1,
          borderColor: state === "error" ? "var(--status-falta)" : undefined,
        }}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (state !== "saving") setState("idle");
        }}
        onBlur={handleBlur}
        aria-invalid={state === "error"}
      />
      {/* Estado sempre visível: antes o "Salvo" era só um tooltip e a falha era silenciosa. */}
      <div aria-live="polite" style={{ minHeight: 14, fontSize: 11, textAlign: "right", marginTop: 2 }}>
        {state === "saving" && <span className="text-ink-faint">Salvando…</span>}
        {state === "saved" && <span style={{ color: "var(--status-realizada, #0e6b3f)" }}>✓ Salvo</span>}
        {state === "error" && (
          <span style={{ color: "var(--status-falta)" }}>
            Não salvou: {error}{" "}
            <button type="button" onClick={handleBlur} className="underline">
              Tentar de novo
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
