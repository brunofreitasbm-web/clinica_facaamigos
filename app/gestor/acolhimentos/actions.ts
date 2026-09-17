"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { nextStatuses, type AcolhimentoFunding } from "@/lib/acolhimento-requests";

type ActionResult = { success: true } | { success: false; error: string };

const FUNDINGS: AcolhimentoFunding[] = ["particular", "convenio"];

/**
 * Gestor solicita uma vaga de acolhimento pra um paciente já cadastrado —
 * cria a linha em `acolhimento_requests` (status default 'solicitado') e, na
 * mesma ação, já avança pra 'aguardando_agendamento': o trabalho do gestor
 * aqui é só "entregar" o pedido pronto pra Recepção agendar, não segurar a
 * fila em 'solicitado' esperando outra pessoa empurrar de novo (ver plano
 * FASE 4, Tarefa 2).
 */
export async function requestAcolhimento(formData: FormData): Promise<ActionResult> {
  const patientId = String(formData.get("patient_id") ?? "").trim();
  const funding = String(formData.get("funding") ?? "").trim();
  const specialtyValue = String(formData.get("specialty_value") ?? "").trim();
  const insurerId = String(formData.get("insurer_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!patientId) {
    return { success: false, error: "Selecione o paciente." };
  }
  if (!FUNDINGS.includes(funding as AcolhimentoFunding)) {
    return { success: false, error: "Selecione a forma de pagamento (particular ou convênio)." };
  }
  if (funding === "convenio" && !insurerId) {
    return { success: false, error: "Selecione o plano de saúde." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted, error: insertError } = await supabase
    .from("acolhimento_requests")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      patient_id: patientId,
      funding,
      specialty_value: specialtyValue || null,
      insurer_id: funding === "convenio" ? insurerId : null,
      notes: notes || null,
      requested_by: user?.id ?? null,
      status: "solicitado",
    })
    .select("id, status")
    .single();

  if (insertError || !inserted) {
    return { success: false, error: "Não foi possível registrar a solicitação de acolhimento." };
  }

  // Avança imediatamente para aguardando_agendamento — nextStatuses garante
  // que esse é sempre o próximo elo válido a partir de 'solicitado', pros
  // dois fundings.
  const allowed = nextStatuses("solicitado", funding as AcolhimentoFunding);
  if (allowed.includes("aguardando_agendamento")) {
    const { error: updateError } = await supabase
      .from("acolhimento_requests")
      .update({ status: "aguardando_agendamento" })
      .eq("id", inserted.id);

    if (updateError) {
      // O pedido já existe — a falha aqui não é crítica o bastante pra
      // reportar erro ao gestor (a Recepção ainda pode avançar manualmente
      // pela própria tela), mas registramos no log do servidor.
      console.error("[requestAcolhimento] erro ao avançar para aguardando_agendamento:", updateError);
    }
  }

  revalidatePath("/gestor/acolhimentos");
  revalidatePath("/recepcao/acolhimentos");
  revalidatePath("/recepcao");
  return { success: true };
}

export async function cancelAcolhimentoRequest(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("acolhimento_requests").update({ status: "cancelado" }).eq("id", requestId);

  if (error) return { success: false, error: "Não foi possível cancelar a solicitação." };

  revalidatePath("/gestor/acolhimentos");
  revalidatePath("/recepcao/acolhimentos");
  revalidatePath("/recepcao");
  return { success: true };
}
