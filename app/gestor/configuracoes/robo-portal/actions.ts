"use server";

// Cadastro dos computadores que rodam o robô do portal do plano
// (docs/portal-robot.md). Substitui o "gerar_token.py + insert no SQL Editor":
// o gestor dá um nome, o sistema gera o token, guarda só o SHA-256 e mostra o
// token UMA vez para colar no .env do agente.
//
// portal_robot_agents só tem policy de leitura (a migration não abre escrita a
// nenhum papel), então a escrita é um bypass deliberado com o client
// service-role — a checagem de "quem pode" vem daqui, como em
// app/gestor/cadastros/colaboradores/actions.ts.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateAgentToken, hashAgentToken, robotAdmin } from "@/lib/portal-robot";
import { normalizeAgentName } from "@/lib/portal-robot-pure";

const PAGE_PATH = "/gestor/configuracoes/robo-portal";

type Fail = { success: false; error: string };

async function requireCallerIsGestor() {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false as const, error: "Sessão expirada. Faça login de novo." };

  const { data: profile } = await session.from("profiles").select("role, clinic_id").eq("id", user.id).maybeSingle();
  if (profile?.role !== "gestor" || !profile.clinic_id) {
    return { ok: false as const, error: "Só o gestor pode cadastrar o robô." };
  }
  return { ok: true as const, clinicId: profile.clinic_id as string };
}

/** Cadastra um computador e devolve o token (a única vez em que ele existe fora do .env). */
export async function createRobotAgent(rawName: string): Promise<{ success: true; name: string; token: string } | Fail> {
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const parsed = normalizeAgentName(rawName);
  if (!parsed.ok) return { success: false, error: parsed.error };

  const token = generateAgentToken();
  const { error } = await robotAdmin()
    .from("portal_robot_agents")
    .insert({ clinic_id: caller.clinicId, name: parsed.value, token_hash: hashAgentToken(token) });
  if (error) return { success: false, error: "Não foi possível cadastrar o robô. Tente de novo." };

  revalidatePath(PAGE_PATH);
  return { success: true, name: parsed.value, token };
}

/** Desativar corta o acesso na hora (o agente passa a receber 401); reativar devolve. */
export async function setRobotAgentActive(agentId: string, active: boolean): Promise<{ success: true } | Fail> {
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const { data, error } = await robotAdmin()
    .from("portal_robot_agents")
    .update({ active })
    .eq("id", agentId)
    .eq("clinic_id", caller.clinicId)
    .select("id");
  if (error || !data || data.length === 0) return { success: false, error: "Não foi possível atualizar. Atualize a tela." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
