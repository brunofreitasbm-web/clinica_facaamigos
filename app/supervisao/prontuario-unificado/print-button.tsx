"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => window.print()}>
      <Printer size={16} /> Imprimir / Exportar PDF
    </button>
  );
}
