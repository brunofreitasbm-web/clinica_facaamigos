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
