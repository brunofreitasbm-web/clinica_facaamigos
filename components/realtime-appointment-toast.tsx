"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ToastState = { message: string; appointmentId: string | null };

/**
 * PRD §3: quando a recepção registra "Na Recepção" (checkin_at), o
 * terapeuta escalado recebe um toast ao vivo — primeira introdução de
 * Supabase Realtime no projeto (`postgres_changes` sobre `appointments`,
 * filtrado por therapist_id). RLS de appointments_read já limita o que
 * este canal pode entregar; o filtro aqui é só eficiência de rede.
 *
 * FASE 6: o toast agora linka direto para a evolução da sessão
 * (/terapeuta/evolucao/[appointmentId]) — o terapeuta não precisa mais
 * navegar manualmente até achar a sessão que acabou de fazer check-in.
 */
export function RealtimeAppointmentToast({ therapistId }: { therapistId: string }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments-therapist-${therapistId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `therapist_id=eq.${therapistId}`,
        },
        (payload) => {
          const before = payload.old as { checkin_at: string | null } | null;
          const after = payload.new as { checkin_at: string | null; id?: string } | null;
          if (after?.checkin_at && !before?.checkin_at) {
            setToast({ message: "Um paciente chegou na recepção.", appointmentId: after.id ?? null });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [therapistId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed right-4 top-4 z-30 flex items-center gap-3 rounded-md border border-paper-line-strong bg-status-active-soft px-4 py-3 text-sm font-medium text-status-active-text shadow-lg"
    >
      <span>{toast.message}</span>
      {toast.appointmentId && (
        <Link
          href={`/terapeuta/evolucao/${toast.appointmentId}`}
          className="whitespace-nowrap rounded-md border border-current px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
        >
          Abrir evolução
        </Link>
      )}
    </div>
  );
}
