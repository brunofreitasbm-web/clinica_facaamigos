// lib/portal-robot.ts
// Lado servidor do robô de autorização no portal do plano (ver
// docs/portal-robot.md e supabase/migrations/20261106120000_portal_robot.sql).
// Usado pelas rotas /api/portal-robot/* que o AGENTE local chama. O agente se
// identifica com um token próprio (Authorization: Bearer …); aqui só existe o
// SHA-256 dele. Tudo com o client service-role, sempre filtrando pela clínica
// do agente — nunca pela clínica que vier no corpo da requisição.
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PortalRobotMode, PortalRobotPayload, PortalRobotStatus } from "@/lib/portal-robot-pure";

export const DOCUMENTS_BUCKET = "clinic-documents";
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

export type PortalRobotJobRow = {
  id: string;
  clinic_id: string;
  draft_id: string;
  portal: string;
  mode: PortalRobotMode;
  status: PortalRobotStatus;
  step: number;
  step_label: string | null;
  payload: PortalRobotPayload;
  portal_summary: Record<string, unknown> | null;
  result: { portal_status?: string | null; guide_number?: string | null; message?: string | null } | null;
  screenshot_path: string | null;
  error: string | null;
  requested_by: string | null;
  requested_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  agent_id: string | null;
  claimed_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type PortalRobotAgent = { id: string; clinic_id: string; name: string };

/** As tabelas novas ainda não estão nos tipos gerados (mesmo cast de lib/reception-queue.ts). */
export function robotAdmin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Token novo de agente (mesmo formato do agente-robo/gerar_token.py). Só é mostrado uma vez. */
export function generateAgentToken(): string {
  return randomBytes(40).toString("base64url");
}

/** Identifica o agente pelo token e registra o "sinal de vida" (tela mostra robô ligado/desligado). */
export async function authenticateAgent(req: Request): Promise<{ admin: SupabaseClient; agent: PortalRobotAgent } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (token.length < 32) return null;

  const admin = robotAdmin();
  const { data: agent } = await admin
    .from("portal_robot_agents")
    .select("id, clinic_id, name, active")
    .eq("token_hash", hashAgentToken(token))
    .maybeSingle();
  if (!agent || !agent.active) return null;

  await admin
    .from("portal_robot_agents")
    .update({ last_seen_at: new Date().toISOString(), last_version: req.headers.get("x-agent-version")?.slice(0, 40) ?? null })
    .eq("id", agent.id);
  return { admin, agent: { id: agent.id, clinic_id: agent.clinic_id, name: agent.name } };
}

/** Pedido do próprio agente: id + clínica + reservado por ele. Qualquer outro caso = 404. */
export async function loadAgentJob(admin: SupabaseClient, agent: PortalRobotAgent, jobId: unknown): Promise<PortalRobotJobRow | null> {
  if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const { data } = await admin
    .from("portal_robot_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("clinic_id", agent.clinic_id)
    .eq("agent_id", agent.id)
    .maybeSingle();
  return (data as PortalRobotJobRow | null) ?? null;
}

/** Link temporário do laudo para o agente baixar (10 min). */
export async function signedLaudoUrl(admin: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, 600);
  return data?.signedUrl ?? null;
}

/** Guarda o print da tela do portal que o agente mandou (PNG/JPEG). */
export async function saveScreenshot(admin: SupabaseClient, job: PortalRobotJobRow, file: File | null): Promise<string | null> {
  if (!file || file.size === 0 || file.size > MAX_SCREENSHOT_BYTES) return null;
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const path = `${job.clinic_id}/portal-robot/${job.id}/${Date.now()}.${type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: type, upsert: false });
  return error ? null : path;
}

/**
 * O robô clicou em Autorizar e o portal aceitou: marca a etapa 2 ("Guia enviada
 * ao plano") como se a recepção tivesse marcado — em nome de quem pediu o envio.
 * Não sobrescreve um envio já marcado à mão.
 */
export async function markDraftGuideSentByRobot(admin: SupabaseClient, job: PortalRobotJobRow): Promise<void> {
  await admin
    .from("registration_drafts")
    .update({ guide_sent_at: new Date().toISOString(), guide_sent_by: job.confirmed_by ?? job.requested_by })
    .eq("id", job.draft_id)
    .eq("clinic_id", job.clinic_id)
    .is("guide_sent_at", null);
}
