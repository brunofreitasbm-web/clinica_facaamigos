"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, UserCheck, X, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast-provider";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { confirmCheckinRequest, discardCheckinRequest } from "./actions";
import { printCoupon } from "@/lib/print-coupon";
import { InteressadoRapidoDialog } from "../interessado-rapido-dialog";

export type ChegadaAppointmentInfo = {
  id: string;
  startsAt: string;
  status: string;
  patientId: string;
  patientName: string;
  therapistName: string;
};

export type ChegadaItem = {
  id: string;
  ticketLabel: string;
  kind: "agendado" | "sem_agendamento";
  matchQuality: "exato" | "ambiguo" | "nome_divergente" | "fora_da_janela" | "nenhum";
  createdAt: string;
  declaredFirstName: string;
  declaredBirthDate: string;
  patientId: string | null;
  patientName: string | null;
  appointmentId: string | null;
  appointment: ChegadaAppointmentInfo | null;
  candidates: ChegadaAppointmentInfo[];
};

const NEGATIVE_APPOINTMENT_STATUSES = [
  "falta_familia",
  "cancelada_familia",
  "cancelada_terapeuta",
  "cancelada_clinica",
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: CLINIC_TIMEZONE });
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

// Depende de Date.now(), então só pode ser calculado depois da montagem no
// cliente — calcular durante o SSR causa mismatch de hidratação (o instante
// do render no servidor difere do instante da hidratação no navegador).
function WaitMinutes({ iso }: { iso: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    setMinutes(minutesAgo(iso));
  }, [iso]);

  return <>{minutes ?? "—"}</>;
}

/** Beep curto via Web Audio API — sem depender de um arquivo de áudio novo.
 * Som é requisito, não enfeite: sem ele a recepção (atendendo telefone, com
 * família no balcão) não percebe a chegada — ver F2 do plano. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Ambiente sem suporte a Web Audio (raro) — silencioso, o badge visual
    // no nav continua funcionando.
  }
}

function ChegadaCard({ item }: { item: ChegadaItem }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    item.appointmentId ?? item.candidates[0]?.id ?? null,
  );
  const [showDiscardForm, setShowDiscardForm] = useState(false);

  const isAmbiguous = item.matchQuality === "ambiguo";
  const isNoMatch = item.kind === "sem_agendamento";
  const cancelledAppointment =
    item.appointment && NEGATIVE_APPOINTMENT_STATUSES.includes(item.appointment.status) ? item.appointment : null;

  function confirm() {
    if (!selectedAppointmentId) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmCheckinRequest(item.id, selectedAppointmentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.warning) toast(result.warning, "info");
      if (result.coupon) printCoupon(result.coupon);
      toast(`Check-in de ${item.declaredFirstName} confirmado.`, "success");
      router.refresh();
    });
  }

  function discard(note: string) {
    setError(null);
    startTransition(async () => {
      const result = await discardCheckinRequest(item.id, note);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast("Chegada descartada.", "info");
      router.refresh();
    });
  }

  const borderColor = cancelledAppointment
    ? "var(--color-error)"
    : isNoMatch
      ? "var(--color-accent-2)"
      : "var(--color-accent)";

  return (
    <div className="card gap-3 p-4" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem" }}>{item.ticketLabel}</p>
          <p className="card-body">
            {item.declaredFirstName} · nasc. {new Date(`${item.declaredBirthDate}T00:00:00`).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span className="text-xs text-ink-faint whitespace-nowrap">
          chegou há <WaitMinutes iso={item.createdAt} /> min
        </span>
      </div>

      {cancelledAppointment && (
        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-error)" }}>
          <AlertTriangle size={14} /> Sessão de {cancelledAppointment.patientName} está cancelada — fale com a família
          antes de confirmar.
        </p>
      )}

      {isNoMatch && (
        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-accent-2-700)" }}>
          <AlertTriangle size={14} /> Não encontramos agendamento para hoje com esses dados.
        </p>
      )}

      {isAmbiguous && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-ink-soft">Mais de uma sessão possível — escolha:</p>
          {item.candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`candidate-${item.id}`}
                checked={selectedAppointmentId === c.id}
                onChange={() => setSelectedAppointmentId(c.id)}
              />
              {c.patientName} · {formatTime(c.startsAt)} · {c.therapistName}
            </label>
          ))}
        </div>
      )}

      {!isAmbiguous && item.appointment && (
        <p className="card-body text-sm">
          {item.appointment.patientName} · sessão às {formatTime(item.appointment.startsAt)} com {item.appointment.therapistName}
        </p>
      )}

      {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!isNoMatch && (
          <button
            type="button"
            disabled={isPending || !selectedAppointmentId}
            onClick={confirm}
            className="btn btn-primary"
            style={{ fontSize: "0.85rem" }}
          >
            <UserCheck size={15} /> Confirmar check-in
          </button>
        )}
        {isNoMatch && !showDiscardForm && <InteressadoRapidoDialog />}
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowDiscardForm((v) => !v)}
          className="btn btn-secondary"
          style={{ fontSize: "0.85rem" }}
        >
          <X size={15} /> Descartar
        </button>
      </div>

      {showDiscardForm && (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const note = new FormData(e.currentTarget).get("note");
            discard(String(note ?? ""));
          }}
        >
          <select name="note" className="input text-xs" required>
            <option value="">Motivo do descarte</option>
            <option value="teste">Teste / engano</option>
            <option value="outro_assunto">Veio por outro assunto (entrega, visita)</option>
            <option value="ja_atendido">Já foi atendido de outra forma</option>
            <option value="outro">Outro</option>
          </select>
          <button type="submit" disabled={isPending} className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
            Confirmar descarte
          </button>
        </form>
      )}
    </div>
  );
}

export function ChegadasList({ initialItems, clinicId }: { initialItems: ChegadaItem[]; clinicId: string }) {
  const router = useRouter();
  const items = initialItems;
  const knownIdsRef = useRef(new Set(initialItems.map((i) => i.id)));

  // Realtime como GATILHO (router.refresh() busca os dados com os joins já
  // resolvidos no servidor) + poll de segurança de 60s, porque o painel da
  // recepção pode ficar aberto o dia todo e o websocket cair sem avisar —
  // mesmo raciocínio de components/realtime-appointment-toast.tsx.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`checkin-requests-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkin_requests", filter: `clinic_id=eq.${clinicId}` },
        () => {
          playChime();
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkin_requests", filter: `clinic_id=eq.${clinicId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    const onVisibility = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  useEffect(() => {
    knownIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="card items-center gap-2 p-8 text-center">
        <DoorOpen size={28} className="text-ink-faint" />
        <p className="card-body">Nenhuma chegada aguardando confirmação.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <ChegadaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
