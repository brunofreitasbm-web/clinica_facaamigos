"use client";

import React, { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, any>> {
  data?: T[];
  columns?: DataTableColumn<T>[];
  title?: string;
  onExport?: (signal: AbortSignal) => Promise<void>;
  exportFileName?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data = [],
  columns = [],
  title = "Dados Registrados",
  onExport,
  exportFileName = "relatorio-dashboard.csv",
  className = "",
}: DataTableProps<T>) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportClick = async () => {
    if (isExporting) return;

    setIsExporting(true);
    const controller = new AbortController();
    const TIMEOUT_MS = 25000; // 25 segundos

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error("TIMEOUT_EXCEEDED"));
      }, TIMEOUT_MS);

      controller.signal.addEventListener("abort", () => clearTimeout(timer));
    });

    try {
      if (onExport) {
        await Promise.race([onExport(controller.signal), timeoutPromise]);
      } else {
        // Simulação de chamada API com suporte a AbortController
        const apiPromise = new Promise<void>((resolve) => {
          const t = setTimeout(() => resolve(), 1500);
          controller.signal.addEventListener("abort", () => clearTimeout(t));
        });
        await Promise.race([apiPromise, timeoutPromise]);
      }

      toast("Relatório exportado com sucesso!", "success");
    } catch (err: unknown) {
      const isTimeout =
        (err instanceof Error && err.message === "TIMEOUT_EXCEEDED") ||
        (err instanceof Error && err.name === "AbortError");

      if (isTimeout) {
        toast(
          "O servidor está demorando mais que o esperado. Tente novamente ou filtre menos dados.",
          "error",
          undefined,
          6000
        );
      } else {
        const message = err instanceof Error ? err.message : "Falha na geração do relatório.";
        toast(`Erro na exportação: ${message}`, "error");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between border-b border-paper-line pb-4 mb-4">
        <h3 className="card-title text-lg font-bold">{title}</h3>
        <button
          type="button"
          onClick={handleExportClick}
          disabled={isExporting}
          aria-busy={isExporting}
          aria-live="polite"
          className="btn btn-primary text-xs font-semibold px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Gerando relatório...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 shrink-0" />
              <span>Exportar</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              {columns.length > 0
                ? columns.map((col) => <th key={col.key}>{col.header}</th>)
                : data.length > 0 &&
                  Object.keys(data[0]).map((key) => (
                    <th key={key} className="capitalize">
                      {key}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id ?? idx}>
                  {columns.length > 0
                    ? columns.map((col) => (
                        <td key={col.key}>
                          {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                        </td>
                      ))
                    : Object.keys(row).map((key) => (
                        <td key={key}>{String(row[key] ?? "—")}</td>
                      ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="text-center py-6 text-ink-faint">
                  Nenhum dado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
