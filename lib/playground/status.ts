import { civilDateInTimeZone } from "../timezone.ts";
import { PLAYGROUND_LATE_AFTER_MINUTES } from "./constants.ts";

/**
 * Status de uma visita ao playground. É calculado na hora a partir dos
 * carimbos (chegada, saída, primeira entrada); nada é gravado e não há cron.
 */
export type PlaygroundVisitStatus =
  | "futura"
  | "aguardando_chegada"
  | "no_playground"
  | "confirmar_saida"
  | "avaliar_agora"
  | "atrasada"
  | "registrada_no_prazo"
  | "registrada_com_atraso"
  | "nao_feita"
  | "faltou"
  | "cancelada";

export interface PlaygroundVisitInput {
  scheduledStart: string;
  durationMin: number;
  arrivedAt: string | null;
  leftAt: string | null;
  cancelledAt: string | null;
  /** `saved_at` da primeira entrada da visita, se houver. */
  firstEntryAt: string | null;
}

const MINUTE_MS = 60_000;

export function computeVisitStatus(
  visit: PlaygroundVisitInput,
  now: Date,
  timeZone: string,
): PlaygroundVisitStatus {
  if (visit.cancelledAt) return "cancelada";

  const visitDay = civilDateInTimeZone(new Date(visit.scheduledStart), timeZone);
  const today = civilDateInTimeZone(now, timeZone);

  if (visit.firstEntryAt) {
    if (visit.leftAt) {
      const deadline = new Date(visit.leftAt).getTime() + PLAYGROUND_LATE_AFTER_MINUTES * MINUTE_MS;
      if (new Date(visit.firstEntryAt).getTime() > deadline) return "registrada_com_atraso";
    }
    return "registrada_no_prazo";
  }

  if (visitDay > today) return "futura";

  if (visitDay < today) {
    // O dia da visita acabou sem nenhuma entrada.
    return visit.arrivedAt ? "nao_feita" : "faltou";
  }

  if (!visit.arrivedAt) return "aguardando_chegada";

  if (!visit.leftAt) {
    const end = new Date(visit.scheduledStart).getTime() + visit.durationMin * MINUTE_MS;
    return now.getTime() >= end ? "confirmar_saida" : "no_playground";
  }

  const late = now.getTime() - new Date(visit.leftAt).getTime() >= PLAYGROUND_LATE_AFTER_MINUTES * MINUTE_MS;
  return late ? "atrasada" : "avaliar_agora";
}

export interface PlaygroundSeriesInput {
  status: "rascunho" | "liberada" | "concluida" | "cancelada";
  /** Início agendado das visitas não canceladas. */
  activeVisitStarts: string[];
}

/** A série fica com "Conclusão pendente" quando passou o dia da última visita agendada. */
export function isConclusionPending(series: PlaygroundSeriesInput, now: Date, timeZone: string): boolean {
  if (series.status !== "liberada") return false;
  if (series.activeVisitStarts.length === 0) return false;
  const today = civilDateInTimeZone(now, timeZone);
  const lastDay = series.activeVisitStarts
    .map((s) => civilDateInTimeZone(new Date(s), timeZone))
    .reduce((a, b) => (a > b ? a : b));
  return lastDay < today;
}

/** Status que exigem ação humana agora, em ordem de urgência (menor = mais urgente). */
export function statusUrgency(status: PlaygroundVisitStatus): number {
  const order: PlaygroundVisitStatus[] = [
    "atrasada",
    "confirmar_saida",
    "avaliar_agora",
    "no_playground",
    "aguardando_chegada",
    "nao_feita",
    "faltou",
    "futura",
    "registrada_com_atraso",
    "registrada_no_prazo",
    "cancelada",
  ];
  return order.indexOf(status);
}
