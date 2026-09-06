"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";

type ConvenioInfo = { insurerName: string; planName: string | null };
type AppointmentInfo = { id: string; startsAt: string; statusLabel: string };

export function PatientContextPanel({ patientId }: { patientId: string }) {
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
          return { insurerName: insurer?.name ?? "Convênio", planName: pi.plan_name };
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
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Convênio
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
    </div>
  );
}
