"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary print:hidden" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
