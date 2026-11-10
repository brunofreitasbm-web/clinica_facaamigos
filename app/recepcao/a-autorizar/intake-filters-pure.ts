// Funções puras da Fila de entrada: agrupar por aba, ordenar por espera, atraso e filtros.
// PURO, sem import com alias `@/` (roda em node:test).

import { INTAKE_GROUP_ORDER, type IntakeGroup } from "../../../lib/intake-queue-pure.ts";
import { matchesSearch } from "../pacientes/pendencias/queue-filters-pure.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias de espera a partir dos quais o caso fica destacado em vermelho. */
export const OVERDUE_DAYS = 5;

function ms(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Agrupa por aba; dentro de cada uma, quem espera há mais tempo vem primeiro. Não altera `items`. */
export function groupItems<T extends { group: IntakeGroup; waitingSince: string }>(items: T[]): Record<IntakeGroup, T[]> {
  const out = {} as Record<IntakeGroup, T[]>;
  for (const g of INTAKE_GROUP_ORDER) out[g] = [];
  for (const item of items) out[item.group].push(item);
  for (const g of INTAKE_GROUP_ORDER) out[g].sort((a, b) => ms(a.waitingSince) - ms(b.waitingSince));
  return out;
}

/** 5 dias ou mais esperando (um dia inteiro conta quando passam 24h completas). */
export function isOverdue(waitingSince: string, now: Date, days: number = OVERDUE_DAYS): boolean {
  const since = Date.parse(waitingSince);
  if (Number.isNaN(since)) return false;
  return now.getTime() - since >= days * DAY_MS;
}

/** "hoje", "há 1 dia", "há 4 dias". */
export function waitLabel(waitingSince: string, now: Date): string {
  const since = Date.parse(waitingSince);
  if (Number.isNaN(since)) return "";
  const days = Math.floor((now.getTime() - since) / DAY_MS);
  if (days <= 0) return "hoje";
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** Busca de texto (nome, telefone, etc.) e "Só os meus". Sem busca e sem "meus", devolve tudo. */
export function filterIntakeItems<T extends { haystack: string; mine: boolean }>(
  items: T[],
  opts: { search: string; onlyMine: boolean },
): T[] {
  return items.filter((item) => {
    if (opts.onlyMine && !item.mine) return false;
    return matchesSearch(item.haystack, opts.search);
  });
}

/** Aba que um parâmetro legado (?etapa= ou ?status=) deve abrir. */
export function legacyTab(params: { etapa?: string | null; status?: string | null }): IntakeGroup | null {
  const key = params.status ?? params.etapa ?? null;
  switch (key) {
    case "docs":
    case "falta_docs":
    case "nao_atendido":
    case "pendencias":
      return "agir_agora";
    case "autorizacao":
    case "aguardando":
      return "aguardando_plano";
    case "agendar":
    case "concluidas":
      return "concluidos";
    default:
      return null;
  }
}

export function isIntakeGroup(value: string | null | undefined): value is IntakeGroup {
  return INTAKE_GROUP_ORDER.includes(value as IntakeGroup);
}
