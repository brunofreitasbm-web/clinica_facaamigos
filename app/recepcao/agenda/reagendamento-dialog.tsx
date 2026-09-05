"use client";

import { useState, useTransition } from "react";
import { rescheduleAppointmentAction } from "./session-actions";

export interface AvailableSlot {
  dateLabel: string;
  timeLabel: string;
  startsAtIso: string;
  endsAtIso: string;
}

export function ReagendamentoDialog({
  appointmentId,
  patientName,
  therapistName,
}: {
  appointmentId: string;
  patientName: string;
  therapistName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Slots sugeridos na semana para reagendamento rápido
  const today = new Date();
  const mockSlots: AvailableSlot[] = [
    {
      dateLabel: "Amanhã (Quinta-feira)",
      timeLabel: "11:00 às 11:50",
      startsAtIso: new Date(today.getTime() + 24 * 3600 * 1000).toISOString(),
      endsAtIso: new Date(today.getTime() + (24 * 3600 + 3000) * 1000).toISOString(),
    },
    {
      dateLabel: "Sexta-feira",
      timeLabel: "14:00 às 14:50",
      startsAtIso: new Date(today.getTime() + 48 * 3600 * 1000).toISOString(),
      endsAtIso: new Date(today.getTime() + (48 * 3600 + 3000) * 1000).toISOString(),
    },
    {
      dateLabel: "Sexta-feira",
      timeLabel: "16:00 às 16:50",
      startsAtIso: new Date(today.getTime() + 50 * 3600 * 1000).toISOString(),
      endsAtIso: new Date(today.getTime() + (50 * 3600 + 3000) * 1000).toISOString(),
    },
  ];

  const handleReschedule = () => {
    if (!selectedSlot) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await rescheduleAppointmentAction(
        appointmentId,
        selectedSlot.startsAtIso,
        selectedSlot.endsAtIso
      );
      if (res.success) {
        setIsOpen(false);
      } else {
        setFeedback(res.error);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        🔄 Reagendar Vaga
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl space-y-5 border border-paper-line">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">
                  Assistente de Sugestão de Reagendamento
                </h3>
                <p className="text-xs text-ink-soft">
                  Recuperação imediata de vaga para {patientName} com {therapistName}.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-ink-soft hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div className="rounded-md bg-red-100 p-3 text-xs text-red-800 font-medium">
                {feedback}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold text-ink uppercase tracking-wide">
                Horários Vagados Disponíveis na Semana:
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {mockSlots.map((slot, i) => (
                  <label
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSlot === slot
                        ? "border-accent bg-accent/10 font-semibold"
                        : "border-paper-line hover:bg-paper-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="reschedule-slot"
                        checked={selectedSlot === slot}
                        onChange={() => setSelectedSlot(slot)}
                        className="accent-accent"
                      />
                      <div>
                        <p className="text-xs font-bold text-ink">{slot.dateLabel}</p>
                        <p className="text-xs text-ink-soft">{slot.timeLabel}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Vaga Livre
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-paper-line">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-paper-line-strong px-4 py-2 text-xs font-medium text-ink hover:bg-paper-subtle"
              >
                Cancelar
              </button>
              <button
                onClick={handleReschedule}
                disabled={!selectedSlot || isPending}
                className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Reagendando..." : "Confirmar Reagendamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
