// lib/portal-invite-pure.ts
// Regras PURAS do convite ao Portal da Família por WhatsApp: quem é elegível, o intervalo aleatório entre
// envios, o teto diário e quando pausar. Sem import com alias `@/`, para rodar em
// `node --test --experimental-strip-types` (tests/portal-invite-pure.test.ts).

import { pickEvaluationRecipient, type GuardianContact } from "./evaluation-recipient-pure.ts";
import { isAnamneseRealizada } from "./portal-metodo-pure.ts";

export type InviteGuardian = GuardianContact & { id: string; portal_first_login_at: string | null };

export type InvitePatient = {
  id: string;
  full_name: string | null;
  evaluated_at: string | null;
  /** Status dos agendamentos de 1ª avaliação (is_evaluation) deste paciente. */
  evaluationStatuses: string[];
  guardians: InviteGuardian[];
};

export type InviteCandidate = {
  patientId: string;
  childName: string;
  guardianId: string;
  guardianFirstName: string;
  phone: string;
};

/** Telefone BR em dígitos com DDI ("5591999998888"); vazio se não parecer um telefone. */
export function toE164Digits(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  const full = d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
  return /^55\d{10,11}$/.test(full) ? full : "";
}

/**
 * Candidatos ao convite. Entra a criança com a 1ª Avaliação (anamnese) REALIZADA cujo responsável com telefone
 * ainda não acessou o Portal, não foi convidado, não pediu PARAR e cujo telefone ainda não apareceu na lista
 * (irmãos compartilham o número: 1 mensagem só). Responsável sem acesso ao Portal em NENHUMA das crianças do
 * mesmo telefone. Ordem aleatória (`rng`), para o ritmo não seguir a ordem do cadastro.
 */
export function pickInviteCandidates(input: {
  patients: InvitePatient[];
  invitedPhones: Set<string>;
  optedOutPhones: Set<string>;
  rng?: () => number;
}): InviteCandidate[] {
  const rng = input.rng ?? Math.random;
  const out: InviteCandidate[] = [];
  const seenPhones = new Set<string>();

  for (const p of input.patients) {
    if (!isAnamneseRealizada({ evaluated_at: p.evaluated_at }, p.evaluationStatuses)) continue;
    const recipient = pickEvaluationRecipient(p.guardians);
    if (!recipient) continue;
    const phone = toE164Digits(recipient.phone);
    if (!phone) continue;
    if (input.invitedPhones.has(phone) || input.optedOutPhones.has(phone) || seenPhones.has(phone)) continue;
    const guardian = p.guardians.find((g) => (g.phone ?? "").trim() === recipient.phone) ?? p.guardians[0];
    if (!guardian) continue;
    // Já entrou no Portal (qualquer responsável com este telefone): não convida.
    if (p.guardians.some((g) => toE164Digits(g.phone) === phone && g.portal_first_login_at)) continue;
    seenPhones.add(phone);
    out.push({
      patientId: p.id,
      childName: (p.full_name ?? "").trim().split(/\s+/)[0] || "seu filho(a)",
      guardianId: guardian.id,
      guardianFirstName: recipient.firstName,
      phone,
    });
  }
  // Fisher-Yates
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Segundos até o próximo envio, sorteados entre min e max (inclusive). */
export function nextGapSeconds(minS: number, maxS: number, rng: () => number = Math.random): number {
  const lo = Math.min(minS, maxS);
  const hi = Math.max(minS, maxS);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pode enviar mais hoje? `sentToday` conta os envios (ok e falha) do dia civil de Belém. */
export function underDailyCap(sentToday: number, dailyCap: number): boolean {
  return sentToday < dailyCap;
}

/** Códigos da Twilio/Meta que indicam limite, qualidade ou bloqueio do número: pausam o disparo todo. */
export const QUALITY_ERROR_CODES = new Set([63018, 63049, 63032, 63038]);

/**
 * Pausa o disparo quando as últimas 3 tentativas falharam ou quando a última falhou por limite/qualidade.
 * `recent`: mais recente primeiro.
 */
export function shouldPause(recent: { ok: boolean; errorCode?: number | null }[]): string | null {
  if (recent[0] && !recent[0].ok && recent[0].errorCode && QUALITY_ERROR_CODES.has(recent[0].errorCode)) {
    return `limite ou qualidade do número (código ${recent[0].errorCode})`;
  }
  if (recent.length >= 3 && recent.slice(0, 3).every((r) => !r.ok)) return "3 falhas seguidas";
  return null;
}

/** Token do link do convite: 16 caracteres sem ambiguidade (sem 0/O/1/l/I). */
export function generateInviteToken(rng: () => number = Math.random): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "";
  for (let i = 0; i < 16; i++) t += alphabet[Math.floor(rng() * alphabet.length)];
  return t;
}

export const PARAR_WORDS = new Set(["parar", "pare", "sair", "stop", "cancelar", "descadastrar"]);

/** A mensagem recebida é um pedido de parada ("PARAR", "Sair."...)? */
export function isStopMessage(body: string | null | undefined): boolean {
  const text = (body ?? "").trim().toLowerCase().replace(/[.!?\s]+$/g, "");
  return PARAR_WORDS.has(text);
}
