// lib/scheduling-promotion-pure.ts
// Agendar a 1ª avaliação NÃO autoriza o paciente: só o plano autorizado (ou a
// dispensa, no particular) o torna "paciente" (status "avaliacao"). Antes,
// scheduleEvaluation promovia sempre; isso tirava da tela de Autorizações quem
// ainda esperava o plano (o sistema o tratava como paciente com prontuário) e o
// mostrava como "Pronto para agendar" sem guia. Puro e sem import com alias `@/`
// para rodar em `node --test --experimental-strip-types`
// (tests/scheduling-promotion-pure.test.ts).

/** Mesma união de EvaluationSchedulingGate (lib/evaluation-agenda.ts). */
export type SchedulingGate = "aguardando_envio_guia" | "aguardando_autorizacao" | "aguardando_habilitacao" | "habilitado";

/**
 * `gate` undefined = paciente sem contato na esteira de documentos (cadastrado
 * presencialmente): não há autorização a esperar, então promove. Com contato,
 * só promove quando já está habilitado (plano autorizou, dispensa ou guia ativa).
 */
export function shouldPromoteOnScheduling(gate: SchedulingGate | undefined): boolean {
  return gate === undefined || gate === "habilitado";
}

export type DraftGateInput = {
  guide_sent_at: string | null;
  plan_authorized_at: string | null;
  authorization_waived: boolean | null;
  scheduling_enabled_at: string | null;
  hasActiveAuth: boolean;
};

/**
 * Regra padrão da fila "Prontos para agendar" (Supervisão): contato vindo de
 * documentos só vira "habilitado" quando a Recepção clica em "Pronto para
 * agendar" (scheduling_enabled_at). Guia enviada, plano autorizado, dispensa ou
 * autorização ativa NÃO liberam sozinhos — no máximo "aguardando_habilitacao".
 */
export function computeDraftGate(d: DraftGateInput): SchedulingGate {
  if (d.scheduling_enabled_at) return "habilitado";
  if (d.plan_authorized_at || d.authorization_waived || d.hasActiveAuth) return "aguardando_habilitacao";
  return d.guide_sent_at ? "aguardando_autorizacao" : "aguardando_envio_guia";
}
