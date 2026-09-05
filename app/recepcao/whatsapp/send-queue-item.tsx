"use client";

import { useState, useTransition } from "react";
import { logWhatsappSent, type WhatsappQueueItem } from "./actions";

export function SendQueueItem({ item }: { item: WhatsappQueueItem }) {
  const [opened, setOpened] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="rounded-md border border-status-positive/30 bg-status-positive-soft/30 p-4 text-sm text-status-positive-text">
        ✓ Lembrete de {item.patientName} marcado como enviado.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-paper-line-strong bg-paper-subtle p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-ink">{item.patientName}</p>
          <p className="text-xs text-ink-soft">
            Resp: {item.guardianName} · {item.discipline} · {item.appointmentDate} às{" "}
            {item.appointmentTime} · {item.roomName}
          </p>
        </div>
        {!item.guardianPhone && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Sem telefone
          </span>
        )}
      </div>

      <p className="rounded-md border border-paper-line bg-paper p-2.5 text-xs text-ink-soft whitespace-pre-wrap">
        {item.message}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={item.whatsappLink ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          aria-disabled={!item.whatsappLink}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            item.whatsappLink
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-gray-200 text-gray-400 pointer-events-none"
          }`}
        >
          Abrir no WhatsApp
        </a>
        <button
          type="button"
          disabled={!opened || isPending}
          onClick={() => {
            setError(null);
            const formData = new FormData();
            formData.set("patient_id", item.patientId);
            if (item.guardianId) formData.set("guardian_id", item.guardianId);
            formData.set("appointment_id", item.appointmentId);
            formData.set("body", item.message);
            startTransition(async () => {
              const result = await logWhatsappSent(formData);
              if (result.success) {
                setSent(true);
              } else {
                setError(result.error ?? "Não foi possível registrar.");
              }
            });
          }}
          className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
          title={!opened ? "Abra no WhatsApp primeiro" : undefined}
        >
          {isPending ? "Registrando…" : "✓ Marcar como enviado"}
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
