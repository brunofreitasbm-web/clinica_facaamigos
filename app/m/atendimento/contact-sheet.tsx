"use client";

import { NON_OCCURRED_IN_FILTER } from "@/lib/appointment-visibility";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { openLeadPendency } from "@/app/recepcao/atendimento/actions";
import { CaseSummary } from "@/app/recepcao/atendimento/case-summary";
import { hasPatientRecord, type ConversationPatch, type ConversationRow } from "@/lib/atendimento/types";

type AppointmentInfo = { id: string; startsAt: string; statusLabel: string };

const STATUS_CLASS: Record<string, string> = {
  confirmada: "st-confirmada",
  agendada: "st-agendada",
  realizada: "st-realizada",
  falta: "st-falta",
  cancelada: "st-cancelada",
};

/**
 * Ficha do contato no celular. Mesma ordem do desktop: resumo do caso (quem é, plano, motivo, próximo passo),
 * agenda e, para lead, o botão de pendências dentro do próprio resumo.
 */
export function ContactSheet({
  conversation,
  onClose,
  onPatch,
}: {
  conversation: ConversationRow;
  onClose: () => void;
  onPatch: (patch: ConversationPatch) => void;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [appointmentsError, setAppointmentsError] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void onPatch; // mantém a assinatura reservada pra uso futuro (edição de nome do contato)
  }, [onPatch]);

  // Só muda quando o vínculo com o prontuário muda; atualizações em tempo real da conversa (não lidas,
  // última mensagem...) não devem refazer a consulta.
  const recordPatientId = hasPatientRecord(conversation) ? conversation.patientId : null;
  useEffect(() => {
    if (!recordPatientId) return;
    let cancelled = false;
    createClient()
      .from("appointments")
      .select("id, starts_at, status")
      .eq("patient_id", recordPatientId)
      .gt("starts_at", new Date().toISOString())
      .not("status", "in", NON_OCCURRED_IN_FILTER)
      .order("starts_at", { ascending: true })
      .limit(3)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        setAppointmentsError(Boolean(queryError));
        setAppointments((data ?? []).map((a) => ({ id: a.id, startsAt: a.starts_at, statusLabel: a.status })));
      });
    return () => {
      cancelled = true;
    };
  }, [recordPatientId]);

  const handleResolverPendencias = async () => {
    setError(null);
    setIsPending(true);
    const result = await openLeadPendency(conversation.id);
    setIsPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/recepcao/pacientes/pendencias?lead=${result.draftId}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "color-mix(in srgb, var(--color-neutral-900) 45%, transparent)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-5 overflow-y-auto bg-white"
        style={{
          borderRadius: "24px 24px 0 0",
          maxHeight: "78vh",
          padding: "14px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        }}
      >
        <div className="mx-auto" style={{ width: 40, height: 5, borderRadius: 9999, background: "var(--color-neutral-300)" }} />

        <CaseSummary
          conversation={conversation}
          onResolvePendencies={handleResolverPendencias}
          resolving={isPending}
        />

        {error && (
          <p role="alert" className="text-[12px]" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}

        {hasPatientRecord(conversation) && (
          <div>
            <h6>Próximos atendimentos</h6>
            {appointmentsError ? (
              <p role="alert" className="text-[14px]" style={{ color: "var(--color-error)" }}>
                Não foi possível carregar a agenda.
              </p>
            ) : appointments.length === 0 ? (
              <p className="text-[14px]" style={{ color: "var(--color-ink-faint)" }}>
                Nenhum atendimento agendado.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-bold tabular-nums">
                      {new Date(a.startsAt).toLocaleString("pt-BR", {
                        timeZone: CLINIC_TIMEZONE,
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className={`tag-status ${STATUS_CLASS[a.statusLabel] ?? "st-cancelada"}`}>{a.statusLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
