"use client";

import { NON_OCCURRED_IN_FILTER } from "@/lib/appointment-visibility";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { CaseSummary } from "./case-summary";
import { ConversationNote } from "./conversation-note";
import type { ConversationRow } from "./atendimento-shell";

type AppointmentInfo = { id: string; startsAt: string; statusLabel: string };

/** "agendada" → "Agendada", "nao_compareceu" → "Nao compareceu": o código do banco, só mais legível. */
function statusText(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Painel lateral de quem já tem prontuário. Mesma ordem do painel de lead (Jakob): resumo do caso
 * (quem é, plano, motivo, ficha), agenda e nota interna. Plano e "Abrir ficha" vivem no resumo.
 */
export function PatientContextPanel({ conversation }: { conversation: ConversationRow }) {
  const patientId = conversation.patientId!;
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", patientId)
      .gt("starts_at", new Date().toISOString())
      .not("status", "in", NON_OCCURRED_IN_FILTER)
      .order("starts_at", { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(true);
        } else {
          setLoadError(false);
          setAppointments((data ?? []).map((a) => ({ id: a.id, startsAt: a.starts_at, statusLabel: a.status })));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, reloadKey]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <CaseSummary conversation={conversation} />

      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Próximos atendimentos
        </h6>
        {loading && <p className="text-xs text-ink-faint">Carregando…</p>}
        {loadError && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            Não foi possível carregar a agenda.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              Tentar de novo
            </button>
          </p>
        )}
        {!loading && !loadError && appointments.length === 0 && (
          <p className="text-xs text-ink-faint">Nenhum atendimento agendado.</p>
        )}
        <ul className="flex flex-col gap-2">
          {appointments.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="font-semibold">
                {new Date(a.startsAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
              </div>
              <div className="text-ink-faint">{statusText(a.statusLabel)}</div>
            </li>
          ))}
        </ul>
      </div>

      <ConversationNote conversationId={conversation.id} />
    </div>
  );
}
