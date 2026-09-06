"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

const MEETING_KINDS = ["interdisciplinar", "devolutiva", "revisao_pdi", "visita_escolar"] as const;

/**
 * Registro de reunião (Módulo 3 MAAIS): técnica multidisciplinar (slide 10
 * etapa 5), devolutiva à família (slides 36-37, checklist de 7 etapas) ou
 * visita escolar (slide 38). Uma reunião `interdisciplinar` conclui a etapa
 * `reuniao_interdisciplinar` do checklist de entrada; uma `devolutiva`
 * conclui `devolutiva_familia` e, se ligada a um plano, grava
 * `treatment_plans.delivered_at` — tudo via trigger de banco (migration
 * 20260906000004_meetings_and_bonding.sql), não nesta action.
 */
export async function createMeeting(patientId: string, formData: FormData): Promise<ActionResult> {
  const kind = String(formData.get("kind") ?? "");
  if (!MEETING_KINDS.includes(kind as (typeof MEETING_KINDS)[number])) {
    return { success: false, error: "Tipo de reunião inválido." };
  }

  const heldAtDate = String(formData.get("held_at_date") ?? "");
  const heldAtTime = String(formData.get("held_at_time") ?? "") || "12:00";
  const minutes = String(formData.get("minutes") ?? "").trim();
  const decisions = String(formData.get("decisions") ?? "").trim();
  const familyPresent = formData.get("family_present") === "on";
  const treatmentPlanId = String(formData.get("treatment_plan_id") ?? "").trim() || null;

  if (!heldAtDate) return { success: false, error: "Informe a data da reunião." };
  if (!minutes) return { success: false, error: "Registre ao menos um resumo da reunião (ata)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  // Checklist da devolutiva (slide 37): preparação, abertura, compartilhamento
  // de dados, escuta ativa, estratégias futuras, alinhamento, encerramento.
  const agenda =
    kind === "devolutiva"
      ? {
          preparacao: formData.get("agenda_preparacao") === "on",
          abertura: formData.get("agenda_abertura") === "on",
          dados: formData.get("agenda_dados") === "on",
          escuta_ativa: formData.get("agenda_escuta") === "on",
          estrategias: formData.get("agenda_estrategias") === "on",
          alinhamento: formData.get("agenda_alinhamento") === "on",
          encerramento: formData.get("agenda_encerramento") === "on",
        }
      : {};

  const { error } = await supabase.from("meetings").insert({
    patient_id: patientId,
    kind,
    held_at: new Date(`${heldAtDate}T${heldAtTime}:00`).toISOString(),
    conducted_by: user.id,
    agenda,
    minutes,
    decisions: decisions || null,
    family_present: familyPresent,
    treatment_plan_id: treatmentPlanId,
  });

  if (error) return { success: false, error: "Não foi possível registrar a reunião. Verifique sua permissão para este paciente." };

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  revalidatePath(`/supervisao/reunioes`);
  revalidatePath("/supervisao");
  return { success: true };
}
