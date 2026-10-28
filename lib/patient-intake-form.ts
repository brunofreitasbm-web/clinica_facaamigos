import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractClientIp, hashIp, memoryThrottleExceeded } from "@/lib/checkin-security";

/**
 * Ficha do paciente preenchida pela família por link público.
 *
 * O link não é autenticado: a única credencial é o token opaco de
 * `patient_intake_form_tokens` (20260909140000). Por isso a resolução do
 * token vive aqui, num módulo `server-only`, e não numa rota — todo caminho
 * que toca a ficha por este fluxo passa por `resolveIntakeToken`, tanto ao
 * abrir a página quanto ao gravar. A action revalida: o token que chega no
 * POST vem do cliente e não vale nada até ser resolvido de novo.
 *
 * Um token é válido enquanto: `active`, não revogado, dentro de `expires_at`
 * e ainda não enviado (uso único).
 *
 * Throttle por IP (20260910130000): a única defesa contra varredura do
 * token era a entropia dele. Mesmo desenho de `checkin-security.ts` — throttle
 * em memória (best-effort, por instância) primeiro, depois o durável por
 * ip_hash em `ficha_token_attempts` (compartilhado entre instâncias).
 */

export type IntakeTokenTarget = {
  tokenId: string;
  patientId: string;
  patientName: string;
};

export type IntakeTokenFailure = "nao_encontrado" | "expirado" | "ja_enviado" | "revogado" | "muitas_tentativas";

const IP_ATTEMPTS_WINDOW_MS = 60 * 60 * 1000;
const IP_ATTEMPTS_MAX = 20;

export async function resolveIntakeToken(
  token: string,
): Promise<{ ok: true; target: IntakeTokenTarget } | { ok: false; reason: IntakeTokenFailure }> {
  const ip = extractClientIp(await headers());
  const ipHash = hashIp(ip);

  if (memoryThrottleExceeded(`ficha:${ipHash}`)) {
    return { ok: false, reason: "muitas_tentativas" };
  }

  const admin = createAdminClient();

  const windowStartIso = new Date(Date.now() - IP_ATTEMPTS_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("ficha_token_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStartIso);
  if ((count ?? 0) >= IP_ATTEMPTS_MAX) {
    return { ok: false, reason: "muitas_tentativas" };
  }
  await admin.from("ficha_token_attempts").insert({ ip_hash: ipHash });

  // Formato conferido antes de ir ao banco: o default da coluna é
  // encode(gen_random_bytes(24), 'hex'), então qualquer coisa fora de 48 hex
  // é lixo/varredura e não merece uma consulta.
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, reason: "nao_encontrado" };
  const { data: row } = await admin
    .from("patient_intake_form_tokens")
    .select("id, patient_id, active, expires_at, submitted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return { ok: false, reason: "nao_encontrado" };
  if (row.revoked_at || !row.active) return { ok: false, reason: "revogado" };
  if (row.submitted_at) return { ok: false, reason: "ja_enviado" };
  if (new Date(row.expires_at) <= new Date()) return { ok: false, reason: "expirado" };

  // Só o nome: a página é pública e serve para a família se reconhecer
  // ("é do meu filho mesmo"). CPF, RG, convênio e contatos dos responsáveis
  // não descem para o navegador em nenhum momento deste fluxo.
  const { data: patient } = await admin
    .from("patients")
    .select("id, full_name")
    .eq("id", row.patient_id)
    .maybeSingle();

  if (!patient) return { ok: false, reason: "nao_encontrado" };

  return {
    ok: true,
    target: { tokenId: row.id, patientId: patient.id, patientName: patient.full_name },
  };
}

export const INTAKE_TOKEN_MESSAGES: Record<IntakeTokenFailure, { title: string; body: string }> = {
  nao_encontrado: {
    title: "Link não encontrado",
    body: "Confira se o endereço foi copiado por inteiro. Se a dúvida continuar, fale com a recepção da clínica.",
  },
  expirado: {
    title: "Este link expirou",
    body: "Por segurança, o link da ficha vale por tempo limitado. Peça um novo à recepção da clínica.",
  },
  ja_enviado: {
    title: "Ficha já enviada",
    body: "Recebemos as informações desta ficha, obrigado! Para corrigir algum dado, fale com a recepção da clínica.",
  },
  revogado: {
    title: "Link desativado",
    body: "Este link foi desativado pela clínica. Peça um novo à recepção.",
  },
  muitas_tentativas: {
    title: "Muitas tentativas",
    body: "Espere um pouco antes de tentar de novo. Se o problema continuar, fale com a recepção da clínica.",
  },
};
