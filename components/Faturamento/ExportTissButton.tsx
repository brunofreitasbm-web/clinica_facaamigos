"use client";

import React, { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface ExportTissButtonProps {
  onExport: (signal: AbortSignal) => Promise<void>;
  disabled?: boolean;
  itemCount?: number;
  className?: string;
  buttonText?: string;
}

export function ExportTissButton({
  onExport,
  disabled = false,
  itemCount = 0,
  className = "",
  buttonText,
}: ExportTissButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportClick = async () => {
    if (isExporting || disabled || itemCount === 0) return;

    setIsExporting(true);

    const controller = new AbortController();
    const timeoutDuration = 25000; // 25 segundos

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error("TIMEOUT_EXCEEDED"));
      }, timeoutDuration);

      // Limpa timer se o controller for abortado externamente
      controller.signal.addEventListener("abort", () => clearTimeout(timer));
    });

    try {
      await Promise.race([onExport(controller.signal), timeoutPromise]);
    } catch (err: unknown) {
      const isTimeout =
        (err instanceof Error && err.message === "TIMEOUT_EXCEEDED") ||
        (err instanceof Error && err.name === "AbortError");

      if (isTimeout) {
        toast(
          "O servidor está demorando mais que o esperado para processar o lote TISS. Tente novamente refinando o filtro de competência.",
          "error",
          undefined,
          6000
        );
      } else {
        const errorMsg = err instanceof Error ? err.message : "Erro inesperado ao gerar lote TISS.";
        toast(`Falha na exportação: ${errorMsg}`, "error");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const labelText = buttonText ?? `⚡ Gerar Lote XML (${itemCount})`;

  return (
    <button
      type="button"
      onClick={handleExportClick}
      disabled={isExporting || disabled || itemCount === 0}
      aria-busy={isExporting}
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-chart px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-chart-strong transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chart disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`}
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Gerando Lote TISS...</span>
        </>
      ) : (
        <span>{labelText}</span>
      )}
    </button>
  );
}
