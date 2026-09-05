"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import {
  getAvailableSlots,
  rescheduleAppointmentAction,
  type AvailableSlot,
} from "./session-actions";

export function ReagendamentoDialog({
  appointmentId,
  patientName,
  therapistName,
  roomId,
  therapistId,
  durationMinutes,
}: {
  appointmentId: string;
  patientName: string;
  therapistName: string;
  roomId: string;
  therapistId: string;
  durationMinutes: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getAvailableSlots(roomId, therapistId, durationMinutes, appointmentId).then((result) => {
      if (cancelled) return;
      setSlots(result);
      setSelectedSlot(null);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, roomId, therapistId, durationMinutes, appointmentId]);

  function close() {
    setIsOpen(false);
    setSlots(null);
    setSelectedSlot(null);
    setFeedback(null);
  }

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
        close();
      } else {
        setFeedback(res.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Reagendar"
        className="btn btn-icon"
      >
        <CalendarClock size={16} />
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
                onClick={close}
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
                {slots === null && <p className="text-xs text-ink-soft">Buscando vagas livres…</p>}
                {slots !== null && slots.length === 0 && (
                  <p className="text-xs text-ink-soft">Nenhuma vaga livre nos próximos 5 dias.</p>
                )}
                {(slots ?? []).map((slot, i) => (
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
                onClick={close}
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
