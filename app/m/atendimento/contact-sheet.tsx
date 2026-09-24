"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Copy, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { formatConversationPhone } from "@/app/recepcao/atendimento/format-phone";
import { openLeadPendency, type LeadDraftInfo } from "@/app/recepcao/atendimento/actions";
import type { ConversationPatch, ConversationRow } from "@/lib/atendimento/types";

const ESCALATION_LABELS: Record<string, string> = {
  fora_da_base: "A dúvida não está na base de conhecimento do bot.",
  clinico: "Pergunta clínica sobre a criança — o bot não responde.",
  pediu_humano: "A pessoa pediu para falar com alguém da equipe.",
  relatorio: "Pedido de relatório/documento — dados coletados na última mensagem do bot, veja a conversa.",
};

type ConvenioInfo = { insurerName: string; planName: string | null };
type AppointmentInfo = { id: string; startsAt: string; statusLabel: string };

const STATUS_CLASS: Record<string, string> = {
  confirmada: "st-confirmada",
  agendada: "st-agendada",
  realizada: "st-realizada",
  falta: "st-falta",
  cancelada: "st-cancelada",
};

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
  const phone = formatConversationPhone(conversation.phoneNumber);
  const [copied, setCopied] = useState(false);
  const [convenios, setConvenios] = useState<ConvenioInfo[]>([]);
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  // Anexos do rascunho de pré-cadastro: no desktop (LeadContextPanel) eles
  // aparecem porque a extração via IA já roda ao abrir o painel. Repetir essa
  // chamada aqui (server action que dispara Gemini) faria o custo de IA
  // acontecer de novo toda vez que alguém abre a folha de contato no
  // celular — por isso o v1 mobile não carrega anexos aqui; "Resolver
  // pendências" leva direto pra tela que já mostra tudo isso.
  const [draft] = useState<LeadDraftInfo | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void onPatch; // mantém a assinatura reservada pra uso futuro (edição de nome do contato)
  }, [onPatch]);

  useEffect(() => {
    if (!conversation.patientId) return;
    let cancelled = false;
    const supabase = createClient();
    const patientId = conversation.patientId;
    Promise.all([
      supabase.from("patient_insurance").select("plan_name, insurers(name)").eq("patient_id", patientId),
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
      setAppointments((appointmentsRes.data ?? []).map((a) => ({ id: a.id, startsAt: a.starts_at, statusLabel: a.status })));
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.patientId]);

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

        <div className="flex items-center gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold"
            style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
          >
            {conversation.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[19px] font-extrabold" style={{ color: "var(--color-text)" }}>
              {conversation.displayName}
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[14px]"
              style={{ color: "var(--color-ink-soft)" }}
              onClick={() => {
                navigator.clipboard?.writeText(phone).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {phone}
              <Copy size={12} style={{ opacity: 0.6 }} />
              {copied && <span style={{ color: "var(--color-teal-700)" }}>Copiado!</span>}
            </button>
          </div>
        </div>

        {conversation.patientId ? (
          <>
            <div>
              <h6>Plano de Saúde</h6>
              {convenios.length === 0 ? (
                <p className="text-[14px]" style={{ color: "var(--color-ink-faint)" }}>
                  Particular.
                </p>
              ) : (
                convenios.map((c, i) => (
                  <div key={i} className="text-[15px]">
                    <div className="font-bold">{c.insurerName}</div>
                    {c.planName && (
                      <div className="text-[14px]" style={{ color: "var(--color-ink-soft)" }}>
                        {c.planName}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div>
              <h6>Próximos atendimentos</h6>
              {appointments.length === 0 ? (
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

            <Link href={`/recepcao/pacientes/${conversation.patientId}`} className="btn btn-secondary w-full justify-center">
              Abrir ficha do paciente
            </Link>
          </>
        ) : (
          <>
            <p className="text-[13px]" style={{ color: "var(--color-ink-faint)" }}>
              Ainda não é paciente: este número não está vinculado a nenhum responsável cadastrado.
            </p>

            {conversation.escalationReason && (
              <div
                className="rounded-[14px] p-3 text-[13px]"
                style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
              >
                <div className="mb-1 font-extrabold">Bot escalou para a equipe</div>
                {ESCALATION_LABELS[conversation.escalationReason] ?? conversation.escalationReason}
              </div>
            )}

            {draft && draft.files.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-[14px] border p-2" style={{ borderColor: "var(--color-paper-line-strong)" }}>
                {draft.files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/arquivos/rascunho/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    <FileText size={12} />
                    {f.originalName ?? "Documento"}
                  </a>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[12px]" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={handleResolverPendencias}
              className="btn btn-primary w-full justify-center gap-1.5"
            >
              <ClipboardList size={16} />
              {isPending ? "Abrindo…" : "Resolver pendências"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
