"use client";

import React, { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface AsyncActionButtonProps {
  onExecute?: (signal: AbortSignal) => Promise<void>;
  label?: string;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Componente de Ação Assíncrona com Prevenção de Request Flooding,
 * AbortController e Timeout de 25s com feedback de Toast (WCAG / Nielsen Heuristic #1).
 */
export function PreCadastrosExportButton({
  onExecute,
  label = "Exportar Pré-Cadastros",
  loadingLabel = "Gerando relatório...",
  disabled = false,
  className = "",
}: AsyncActionButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleAction = async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);

    const controller = new AbortController();
    const timeoutDuration = 25000; // 25 segundos

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error("TIMEOUT_EXCEEDED"));
      }, timeoutDuration);

      controller.signal.addEventListener("abort", () => clearTimeout(timer));
    });

    try {
      if (onExecute) {
        await Promise.race([onExecute(controller.signal), timeoutPromise]);
      } else {
        // Fallback simulado para teste de chamada assíncrona
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
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
        const msg = err instanceof Error ? err.message : "Erro ao processar solicitação.";
        toast(msg, "error");
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={isExporting || disabled}
      aria-busy={isExporting}
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#1967D2] hover:bg-[#1557B0] active:bg-[#104791] text-white px-4 py-2 text-sm font-semibold shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1967D2] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`}
    >
      {isExporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default PreCadastrosExportButton;
