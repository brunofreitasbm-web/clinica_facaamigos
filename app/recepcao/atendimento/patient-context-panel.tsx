"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { ConversationNote } from "./conversation-note";
import type { ConversationRow } from "./atendimento-shell";

type ConvenioInfo = { insurerName: string; planName: string | null };
type AppointmentInfo = { id: string; startsAt: string; statusLabel: string };

export function PatientContextPanel({ conversation }: { conversation: ConversationRow }) {
  const patientId = conversation.patientId!;
  const [convenios, setConvenios] = useState<ConvenioInfo[]>([]);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    Promise.all([
      supabase
        .from("patient_insurance")
        .select("plan_name, insurers(name)")
        .eq("patient_id", patientId),
      supabase
        .from("appointments")
        .select("id, starts_at, status")
        .eq("patient_id", patientId)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3),
    ]).then(([insuranceRes, appointmentsRes]) => {
      if (cancelled) return;
      setConvenios(
        (insuranceRes.data ?? []).map((pi) => {
          const insurer = Array.isArray(pi.insurers) ? pi.insurers[0] : pi.insurers;
          return { insurerName: insurer?.name ?? "Plano de Saúde", planName: pi.plan_name };
        }),
      );
      setAppointments(
        (appointmentsRes.data ?? []).map((a) => ({
          id: a.id,
          startsAt: a.starts_at,
          statusLabel: a.status,
        })),
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <Link href={`/recepcao/pacientes/${patientId}`} className="btn btn-secondary w-full justify-center text-sm">
        Abrir ficha do paciente
      </Link>

      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Plano de Saúde
        </h6>
        {loading && <p className="text-xs text-ink-faint">Carregando…</p>}
        {!loading && convenios.length === 0 && <p className="text-xs text-ink-faint">Particular.</p>}
        {convenios.map((c, i) => (
          <div key={i} className="text-sm">
            <div className="font-semibold">{c.insurerName}</div>
            {c.planName && <div className="text-ink-soft">{c.planName}</div>}
          </div>
        ))}
      </div>

      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Próximos atendimentos
        </h6>
        {!loading && appointments.length === 0 && (
          <p className="text-xs text-ink-faint">Nenhum atendimento agendado.</p>
        )}
        <ul className="flex flex-col gap-2">
          {appointments.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="font-semibold">
                {new Date(a.startsAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
              </div>
              <div className="text-ink-faint">{a.statusLabel}</div>
            </li>
          ))}
        </ul>
      </div>

      <ConversationNote conversationId={conversation.id} />
    </div>
  );
}
