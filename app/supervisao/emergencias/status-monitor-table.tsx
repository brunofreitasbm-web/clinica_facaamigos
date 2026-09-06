"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CallStatus = "queued" | "ringing" | "completed" | "no-answer" | "busy" | "failed";

type LogRow = {
  id: string;
  patient_id: string;
  phone_number: string;
  call_status: string;
  attempt_number: number;
  fallback_sent: boolean;
};

const STATUS_LABEL: Record<CallStatus, string> = {
  queued: "Chamando...",
  ringing: "Chamando...",
  completed: "Atendida",
  busy: "Ocupado",
  "no-answer": "Sem Resposta",
  failed: "Falha",
};

const STATUS_STYLE: Record<CallStatus, string> = {
  queued: "bg-blue-50 text-blue-700",
  ringing: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  busy: "bg-amber-50 text-amber-700",
  "no-answer": "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status as CallStatus] ?? status;
}

function statusStyle(status: string): string {
  return STATUS_STYLE[status as CallStatus] ?? "bg-paper-subtle text-ink-soft";
}

/**
 * Painel ao vivo do disparo de emergência: assina `postgres_changes` sobre
 * voice_emergency_logs filtrado por broadcast_id (mesmo padrão de realtime
 * de components/realtime-appointment-toast.tsx, primeira introdução no
 * projeto) e mantém a tabela atualizada conforme o webhook de status do
 * Twilio (app/api/twilio/voice/status/route.ts) vai escrevendo.
 */
export function StatusMonitorTable({ broadcastId }: { broadcastId: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();

    async function loadInitial() {
      const { data } = await supabase
        .from("voice_emergency_logs")
        .select("id, patient_id, phone_number, call_status, attempt_number, fallback_sent")
        .eq("broadcast_id", broadcastId);

      if (data) {
        setRows(data);
        const patientIds = Array.from(new Set(data.map((r) => r.patient_id)));
        if (patientIds.length > 0) {
          const { data: patients } = await supabase.from("patients").select("id, full_name").in("id", patientIds);
          const map: Record<string, string> = {};
          for (const p of patients ?? []) map[p.id] = p.full_name;
          setPatientNames(map);
        }
      }
    }

    loadInitial();

    const channel = supabase
      .channel(`voice-emergency-logs-${broadcastId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_emergency_logs",
          filter: `broadcast_id=eq.${broadcastId}`,
        },
        (payload) => {
          const updated = payload.new as LogRow;
          setRows((prev) => {
            const exists = prev.some((r) => r.id === updated.id);
            if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
            return [...prev, updated];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [broadcastId]);

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Paciente</th>
          <th>Telefone</th>
          <th>Status</th>
          <th>Tentativas</th>
          <th>Fallback enviado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{patientNames[row.patient_id] ?? "—"}</td>
            <td>{row.phone_number}</td>
            <td>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyle(row.call_status)}`}>
                {statusLabel(row.call_status)}
              </span>
            </td>
            <td>{row.attempt_number}</td>
            <td>{row.fallback_sent ? "Sim" : "Não"}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="text-ink-faint">
              Aguardando início das chamadas…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
