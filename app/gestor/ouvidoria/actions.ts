"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const KINDS = ["reclamacao", "evento_adverso", "nao_conformidade"] as const;
const SEVERITIES = ["baixa", "media", "alta", "critica"] as const;

/** Registra um incidente/reclamação/não conformidade. RLS (incident_reports_insert) exige reported_by = auth.uid(). */
export async function createIncident(formData: FormData): Promise<ActionResult> {
  const kind = String(formData.get("kind") ?? "");
  const severity = String(formData.get("severity") ?? "baixa");
  const patientId = String(formData.get("patientId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const occurredAt = String(formData.get("occurredAt") ?? "").trim();

  if (!KINDS.includes(kind as (typeof KINDS)[number])) return { success: false, error: "Selecione o tipo de registro." };
  if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) return { success: false, error: "Selecione a gravidade." };
  if (!description) return { success: false, error: "Descreva o ocorrido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { error } = await supabase.from("incident_reports").insert({
    clinic_id: DEV_CLINIC_ID,
    kind,
    severity,
    patient_id: patientId || null,
    description,
    occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    reported_by: user.id,
  });

  if (error) {
    return { success: false, error: "Não foi possível registrar — verifique sua permissão." };
  }

  revalidatePath("/gestor/ouvidoria");
  return { success: true };
}

export async function updateIncidentStatus(
  incidentId: string,
  status: "aberto" | "em_analise" | "plano_de_acao" | "resolvido" | "arquivado",
  actionPlan?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("incident_reports")
    .update({
      status,
      ...(actionPlan !== undefined ? { action_plan: actionPlan } : {}),
      ...(status === "resolvido" ? { resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null } : {}),
    })
    .eq("id", incidentId);

  if (error) {
    return { success: false, error: "Não foi possível atualizar — verifique sua permissão de gestor/supervisão." };
  }

  revalidatePath("/gestor/ouvidoria");
  return { success: true };
}
