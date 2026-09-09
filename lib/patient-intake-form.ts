import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
 */

export type IntakeTokenTarget = {
  tokenId: string;
  patientId: string;
  patientName: string;
};

export type IntakeTokenFailure = "nao_encontrado" | "expirado" | "ja_enviado" | "revogado";

export async function resolveIntakeToken(
  token: string,
): Promise<{ ok: true; target: IntakeTokenTarget } | { ok: false; reason: IntakeTokenFailure }> {
  // Formato conferido antes de ir ao banco: o default da coluna é
  // encode(gen_random_bytes(24), 'hex'), então qualquer coisa fora de 48 hex
  // é lixo/varredura e não merece uma consulta.
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, reason: "nao_encontrado" };

  const admin = createAdminClient();
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
};
