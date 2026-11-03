"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { formatConversationPhone } from "@/app/recepcao/atendimento/format-phone";
import { markConversationParticularAndSchedule } from "@/app/recepcao/pacientes/pendencias/draft-pipeline-actions";
import {
  PARTICULAR_SALE_REASON,
  applyConversationChange,
  type ParticularAlertConversation,
} from "@/lib/atendimento/particular-alert-pure";

type ConversationRecord = {
  id: string;
  status: string;
  escalation_reason: string | null;
  assigned_to: string | null;
  patient_id: string | null;
  contact_name: string | null;
  phone_number: string;
};

const toAlert = (r: ConversationRecord): ParticularAlertConversation => ({
  id: r.id,
  status: r.status,
  escalationReason: r.escalation_reason,
  assignedTo: r.assigned_to,
  patientId: r.patient_id,
  contactName: r.contact_name,
  phoneNumber: r.phone_number,
});

/**
 * Pop-up visual para supervisão e recepção: uma família pediu para agendar a
 * avaliação particular e ninguém assumiu. Aparece em qualquer tela do módulo
 * (a pílula pulsante da lista só aparece no Atendimento) e fica até alguém
 * agir — marcar como particular, assumir a conversa ou ela ser encerrada.
 * RLS de twilio_conversations já limita o que o canal realtime entrega.
 */
export function ParticularSaleAlert({
  conversationHref = (id) => `/recepcao/atendimento?c=${id}`,
  placement = "bottom",
}: {
  /** Destino do "Abrir conversa" — o PWA mobile tem rota própria por conversa. */
  conversationHref?: (conversationId: string) => string;
  /** No celular fica no topo (respeitando a área segura) para não cobrir o campo de mensagem. */
  placement?: "bottom" | "top";
} = {}) {
  const router = useRouter();
  const [items, setItems] = useState<ParticularAlertConversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Estado inicial: conversas que já estavam esperando antes de a tela abrir.
    void supabase
      .from("twilio_conversations")
      .select("id, status, escalation_reason, assigned_to, patient_id, contact_name, phone_number")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("status", "pending")
      .eq("escalation_reason", PARTICULAR_SALE_REASON)
      .is("assigned_to", null)
      .is("patient_id", null)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setItems((current) =>
          (data as ConversationRecord[]).reduce((acc, row) => applyConversationChange(acc, toAlert(row)), current),
        );
      });

    const channel = supabase
      .channel("particular-sale-alert")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "twilio_conversations", filter: `clinic_id=eq.${DEV_CLINIC_ID}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) setItems((cur) => cur.filter((c) => c.id !== old.id));
            return;
          }
          setItems((cur) => applyConversationChange(cur, toAlert(payload.new as ConversationRecord)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const markParticular = useCallback(
    (conversationId: string) => {
      setError(null);
      startTransition(async () => {
        const res = await markConversationParticularAndSchedule(conversationId);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setItems((cur) => cur.filter((c) => c.id !== conversationId));
        router.push(`/recepcao/pre-cadastros/${res.draftId}`);
      });
    },
    [router],
  );

  if (items.length === 0) return null;

  return (
    <div role="alertdialog" aria-live="assertive" aria-label="Venda particular aguardando" className={`fixed right-4 z-40 flex w-[min(92vw,22rem)] flex-col gap-2 ${placement === "top" ? "" : "bottom-4"}`}
      style={placement === "top" ? { top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" } : undefined}
    >
      {items.map((c) => (
        <div
          key={c.id}
          className="animate-pulse rounded-lg border-2 border-red-500 bg-white p-3 shadow-xl"
          style={{ animationDuration: "2s" }}
        >
          <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-red-700">
            <BellRing size={16} aria-hidden />
            Venda particular — agendar avaliação
          </div>
          <p className="text-xs text-ink-soft">
            {c.contactName ?? formatConversationPhone(c.phoneNumber)} quer agendar a 1ª avaliação sem plano de saúde. Ninguém assumiu a conversa.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={isPending} onClick={() => markParticular(c.id)} className="btn btn-primary text-xs">
              {isPending ? "Marcando…" : "Marcar particular e agendar"}
            </button>
            <Link href={conversationHref(c.id)} className="btn text-xs">
              Abrir conversa
            </Link>
          </div>
        </div>
      ))}
      {error && <p className="rounded bg-white p-2 text-xs text-red-600 shadow">⚠️ {error}</p>}
    </div>
  );
}
