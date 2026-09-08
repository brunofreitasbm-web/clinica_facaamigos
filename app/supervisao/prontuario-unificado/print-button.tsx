"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

export function PrintButton({ hasRecords }: { hasRecords: boolean }) {
  const [isExporting, setIsExporting] = useState(false);

  function handleClick() {
    if (!hasRecords || isExporting) return;
    setIsExporting(true);
    window.print();
    // window.print() blocks until the dialog closes, but browsers vary — release the guard shortly after so a stuck dialog doesn't lock the button forever.
    setTimeout(() => setIsExporting(false), 1000);
  }

  return (
    <button
      type="button"
      className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={!hasRecords || isExporting}
      title={!hasRecords ? "Não há registros clínicos para exportar" : undefined}
    >
      <Printer size={16} /> {isExporting ? "Gerando PDF..." : "Imprimir / Exportar PDF"}
    </button>
  );
}
