"use client";

import { useState, useTransition } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { ABSENCE_REASON_LABEL } from "@/lib/absence-reasons";
import { resolveAbsenceReport, getAbsenceAttachmentUrl } from "./absence-actions";

export type PendingAbsenceReport = {
  id: string;
  appointmentStartsAt: string;
  reasonCategory: string;
  reasonText: string | null;
  hasAttachment: boolean;
  reportedByName: string;
};

export function AbsenceReportsList({
  patientId,
  reports,
}: {
  patientId: string;
  reports: PendingAbsenceReport[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  function resolve(id: string, decision: "aprovado" | "rejeitado") {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setActiveId(id);
    startTransition(async () => {
      const result = await resolveAbsenceReport(patientId, id, decision);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [id]: result.error }));
      }
      setActiveId(null);
    });
  }

  function openAttachment(id: string) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      const result = await getAbsenceAttachmentUrl(id);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [id]: result.error }));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  if (reports.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhuma falta aguardando análise.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {reports.map((r) => (
        <li key={r.id} className="rounded-md border border-paper-line-strong bg-paper px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-ink">
              Sessão de {new Date(r.appointmentStartsAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
            </span>
            <span className="inline-block rounded-full bg-status-pending-soft px-2 py-0.5 text-xs font-medium text-status-pending-text">
              {ABSENCE_REASON_LABEL[r.reasonCategory] ?? r.reasonCategory}
            </span>
          </div>
          <p className="mt-1 text-ink-soft">Informado por {r.reportedByName}</p>
          {r.reasonText && <p className="mt-1 text-ink-faint">&ldquo;{r.reasonText}&rdquo;</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {r.hasAttachment && (
              <button
                type="button"
                onClick={() => openAttachment(r.id)}
                disabled={isPending}
                className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink"
              >
                Ver anexo
              </button>
            )}
            <button
              type="button"
              onClick={() => resolve(r.id, "aprovado")}
              disabled={isPending}
              className="rounded-md bg-chart px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
            >
              {isPending && activeId === r.id ? "Salvando…" : "Aprovar (falta justificada)"}
            </button>
            <button
              type="button"
              onClick={() => resolve(r.id, "rejeitado")}
              disabled={isPending}
              className="rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink disabled:opacity-50"
            >
              Rejeitar
            </button>
          </div>
          {errors[r.id] && <p className="mt-1 text-xs text-status-negative-text">{errors[r.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
