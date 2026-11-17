import { civilDateInTimeZone } from "../timezone.ts";
import { computeVisitStatus, isConclusionPending, statusUrgency } from "./status.ts";

/**
 * Fila "o que precisa de ação agora" da Supervisão no menu Playground. A tela
 * traz o trabalho: o que está atrasado, pendente ou não aconteceu, em ordem de
 * urgência, com a ação certa em cada linha.
 */
export type QueueKind =
  | "atrasada"
  | "conclusao_pendente"
  | "confirmar_saida"
  | "nao_feita"
  | "faltou"
  | "rascunho";

const KIND_ORDER: QueueKind[] = ["atrasada", "conclusao_pendente", "confirmar_saida", "nao_feita", "faltou", "rascunho"];

export interface QueueSeries {
  id: string;
  status: "rascunho" | "liberada" | "concluida" | "cancelada";
  patientName: string;
  locationName: string;
}

export interface QueueVisit {
  id: string;
  seriesId: string;
  visitNo: number;
  scheduledStart: string;
  durationMin: number;
  arrivedAt: string | null;
  leftAt: string | null;
  cancelledAt: string | null;
  firstEntryAt: string | null;
}

export interface QueueItem {
  key: string;
  kind: QueueKind;
  seriesId: string;
  visitId: string | null;
  patientName: string;
  locationName: string;
  /** Início da visita relacionada (ou da última visita, na conclusão pendente). */
  referenceStart: string | null;
  visitNo: number | null;
}

/** Visitas perdidas há mais que isso saem da fila (viram histórico). */
export const QUEUE_LOOKBACK_DAYS = 14;

export function buildSupervisorQueue(args: {
  series: QueueSeries[];
  visits: QueueVisit[];
  now: Date;
  timeZone: string;
}): QueueItem[] {
  const { series, visits, now, timeZone } = args;
  const items: QueueItem[] = [];
  const cutoff = now.getTime() - QUEUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  for (const s of series) {
    const own = visits.filter((v) => v.seriesId === s.id);
    const base = { seriesId: s.id, patientName: s.patientName, locationName: s.locationName };

    if (s.status === "rascunho") {
      items.push({ ...base, key: `rascunho:${s.id}`, kind: "rascunho", visitId: null, referenceStart: null, visitNo: null });
      continue;
    }
    if (s.status !== "liberada") continue;

    const active = own.filter((v) => !v.cancelledAt);
    if (isConclusionPending({ status: "liberada", activeVisitStarts: active.map((v) => v.scheduledStart) }, now, timeZone)) {
      const last = [...active].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)).at(-1);
      items.push({
        ...base,
        key: `conclusao:${s.id}`,
        kind: "conclusao_pendente",
        visitId: last?.id ?? null,
        referenceStart: last?.scheduledStart ?? null,
        visitNo: last?.visitNo ?? null,
      });
    }

    for (const v of active) {
      if (new Date(v.scheduledStart).getTime() < cutoff) continue;
      const status = computeVisitStatus(
        {
          scheduledStart: v.scheduledStart,
          durationMin: v.durationMin,
          arrivedAt: v.arrivedAt,
          leftAt: v.leftAt,
          cancelledAt: v.cancelledAt,
          firstEntryAt: v.firstEntryAt,
        },
        now,
        timeZone,
      );
      if (status === "atrasada" || status === "confirmar_saida" || status === "nao_feita" || status === "faltou") {
        items.push({
          ...base,
          key: `${status}:${v.id}`,
          kind: status,
          visitId: v.id,
          referenceStart: v.scheduledStart,
          visitNo: v.visitNo,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    return (a.referenceStart ?? "").localeCompare(b.referenceStart ?? "");
  });
}

export interface SlaRow {
  month: string;
  onTime: boolean;
}

/** Indicador "Feitas no prazo" do mês, com o mês anterior como comparativo (regra 1 do AGENTS.md). */
export function computeOnTimeKpi(
  rows: SlaRow[],
  now: Date,
  timeZone: string,
): {
  current: { onTime: number; total: number; pct: number | null };
  previous: { onTime: number; total: number; pct: number | null };
  deltaPp: number | null;
} {
  const today = civilDateInTimeZone(now, timeZone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const previousMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const tally = (month: string) => {
    const own = rows.filter((r) => r.month === month);
    const onTime = own.filter((r) => r.onTime).length;
    return { onTime, total: own.length, pct: own.length > 0 ? Math.round((onTime / own.length) * 100) : null };
  };
  const current = tally(currentMonth);
  const previous = tally(previousMonth);
  const deltaPp = current.pct !== null && previous.pct !== null ? current.pct - previous.pct : null;
  return { current, previous, deltaPp };
}

export { statusUrgency };
