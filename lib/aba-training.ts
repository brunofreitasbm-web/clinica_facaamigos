// lib/aba-training.ts
//
// Regras do Treino ABA compartilhadas entre o cadastro (gestor), o
// agendamento (recepção) e o cálculo de saldo. O banco é a autoridade —
// supabase/migrations/20260910020000_aba_training.sql tem os mesmos limites
// como CHECK/trigger — mas a UI precisa dos mesmos valores pra montar o
// formulário e pra avisar antes de o INSERT ser rejeitado.

/** Horários fechados de entrada de turma (CHECK em aba_training_classes.start_time). */
export const ABA_CLASS_START_TIMES = ["08:00", "10:00", "14:00", "16:00"] as const;

export type AbaClassStartTime = (typeof ABA_CLASS_START_TIMES)[number];

/** 0=domingo..6=sábado — mesma convenção de `extract(dow)` e `Date.getUTCDay()`. */
export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** Dias em que a clínica abre à tarde — sábado fecha 12h, domingo não abre. */
export const ABA_CLASS_WEEKDAYS = [1, 2, 3, 4, 5, 6];

export type AbaClassOption = {
  id: string;
  roomId: string;
  roomName: string;
  capacity: number;
  dayOfWeek: number;
  /** `"HH:mm"` (a coluna `time` volta como `"HH:mm:ss"` do PostgREST). */
  startTime: string;
};

/** Normaliza `time` do Postgres (`"08:00:00"`) para o `"08:00"` que o input espera. */
export function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

export function formatAbaClassLabel(cls: AbaClassOption): string {
  return `${cls.roomName} · ${WEEKDAY_LABELS[cls.dayOfWeek]} · ${toHourMinute(cls.startTime)}`;
}

export type PoolAuthorization = {
  procedureCode: string;
  sessionsAuthorized: number;
  sessionsUsed: number;
  validFrom: string;
  validTo: string;
};

export type AbaBalance = {
  /** Sessões de 40min ainda livres somando TODAS as guias ABA do paciente. */
  sessionsRemaining: number;
  /** Quantos blocos de 2h ainda cabem nesse saldo. */
  blocksAvailable: number;
};

/**
 * Espelho em TS da função SQL `aba_training_balance` — mesma soma, mesmos
 * filtros. Existe pra a home da recepção calcular o saldo de todos os
 * pacientes a partir das autorizações que ela já carregou, em vez de um RPC
 * por paciente; o número que vale na hora de fechar a sessão continua sendo
 * o do banco.
 */
export function computeAbaBalance(
  authorizations: PoolAuthorization[],
  poolProcedureCodes: string[],
  sessionsPerBlock: number,
  onDate: string,
): AbaBalance {
  const pool = new Set(poolProcedureCodes);
  const sessionsRemaining = authorizations.reduce((total, auth) => {
    if (!pool.has(auth.procedureCode)) return total;
    if (onDate < auth.validFrom || onDate > auth.validTo) return total;
    const free = auth.sessionsAuthorized - auth.sessionsUsed;
    return free > 0 ? total + free : total;
  }, 0);

  return {
    sessionsRemaining,
    blocksAvailable: sessionsPerBlock > 0 ? Math.floor(sessionsRemaining / sessionsPerBlock) : 0,
  };
}
