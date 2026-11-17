// Avaliação paralela no playground (VB-MAPP em até 5 visitas).
// Regras do dono do projeto: prazo de 40 min depois da saída, nada passa
// para o dia seguinte, no máximo 5 visitas por série.

/** Minutos após a saída da criança em que a avaliação ainda está "no prazo". */
export const PLAYGROUND_LATE_AFTER_MINUTES = 40;

/** Máximo de visitas por série. */
export const PLAYGROUND_MAX_VISITS = 5;

/** Durações permitidas de uma visita, em minutos: só 60 e 120 (regra do dono do projeto). */
export const PLAYGROUND_VISIT_DURATIONS = [60, 120] as const;
export const PLAYGROUND_DEFAULT_DURATION = 60;

export function isAllowedVisitDuration(minutes: number): boolean {
  return (PLAYGROUND_VISIT_DURATIONS as readonly number[]).includes(minutes);
}

/** Janela de validade da assinatura entre o PDV e a clínica. */
export const BRIDGE_SIGNATURE_TOLERANCE_SECONDS = 300;

/** ~60 s de áudio webm/opus em base64, com folga (1,5 MB). */
export const PLAYGROUND_MAX_AUDIO_BASE64_LENGTH = 1_500_000;

/** Tolerância para `saved_at` no futuro (relógio do tablet adiantado). */
export const PLAYGROUND_FUTURE_SKEW_SECONDS = 300;
