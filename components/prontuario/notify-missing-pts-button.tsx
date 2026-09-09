"use client";

import { useState, useTransition } from "react";
import { BellRing, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { notifySupervisorMissingPtsAction } from "./notify-pts-actions";

export function NotifyMissingPtsButton({
  patientId,
  initialHasNotice = false,
}: {
  patientId?: string;
  initialHasNotice?: boolean;
}) {
  const [hasNotice, setHasNotice] = useState(initialHasNotice);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!patientId) return null;

  const handleNotify = () => {
    setError(null);
    startTransition(async () => {
      const res = await notifySupervisorMissingPtsAction(patientId);
      if (res.success) {
        setHasNotice(true);
      } else {
        setError(res.error ?? "Erro ao enviar notificação.");
      }
    });
  };

  if (hasNotice) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 shadow-2xs">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>Notificação de falta de PTS enviada ao Supervisor</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={handleNotify}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
        style={{ backgroundColor: "var(--color-accent-1, #e11d48)" }}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>Enviando aviso...</span>
          </>
        ) : (
          <>
            <BellRing className="h-4 w-4 shrink-0" />
            <span>Avisar Supervisor de Falta de PTS</span>
          </>
        )}
      </button>
      {error && (
        <span className="text-xs font-medium text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
