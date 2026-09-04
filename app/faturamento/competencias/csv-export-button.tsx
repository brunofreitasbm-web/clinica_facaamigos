"use client";

import { useState, useTransition } from "react";
import { exportCompetenceCsv } from "./actions";

export function CsvExportButton({ billingPeriodId }: { billingPeriodId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportCompetenceCsv(billingPeriodId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleExport} disabled={isPending} className="btn btn-secondary">
        {isPending ? "Exportando…" : "Exportar CSV"}
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
