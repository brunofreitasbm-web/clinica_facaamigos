"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * PRD §3: quando a recepção registra "Na Recepção" (checkin_at), o
 * terapeuta escalado recebe um toast ao vivo — primeira introdução de
 * Supabase Realtime no projeto (`postgres_changes` sobre `appointments`,
 * filtrado por therapist_id). RLS de appointments_read já limita o que
 * este canal pode entregar; o filtro aqui é só eficiência de rede.
 */
export function RealtimeAppointmentToast({ therapistId }: { therapistId: string }) {
  const [message, setMessage] = useState<string | null>(null);

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
          const after = payload.new as { checkin_at: string | null } | null;
          if (after?.checkin_at && !before?.checkin_at) {
            setMessage("Um paciente chegou na recepção.");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [therapistId]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 8000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed right-4 top-4 z-30 rounded-md border border-paper-line-strong bg-status-active-soft px-4 py-3 text-sm font-medium text-status-active-text shadow-lg"
    >
      {message}
    </div>
  );
}
