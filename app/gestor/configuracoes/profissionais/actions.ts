"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Registra um novo contrato de Honorário por Módulo Assistencial pro
 * terapeuta (tabela real `therapist_contracts`, cláusula 6ª do
 * contrato-quadro PJ–PJ — não é mais valor-hora por sessão). RLS
 * (therapist_contracts_manage_by_gestor) só libera escrita pra gestor —
 * mesma trava que já existe no banco.
 *
 * `therapist_contracts` tem uma exclusion constraint (profile_id, período)
 * que impede duas faixas se sobrepondo: fecha a faixa aberta anterior no dia
 * anterior à nova vigência antes de inserir, em vez de deixar o terapeuta
 * sem contrato "fechado" ao trocar de faixa.
 */
export async function setTherapistContract(profileId: string, formData: FormData): Promise<ActionResult> {
  const tier = String(formData.get("tier") ?? "").trim();
  const modulePrice = Number(formData.get("module_price") ?? 0);
  const attendancesPerModule = Number(formData.get("attendances_per_module") ?? 6);
  const docDeadlineDays = Number(formData.get("doc_deadline_days") ?? 3);
  const noshowCompensationPct = Number(formData.get("noshow_compensation_pct") ?? 50);
  const validFrom = String(formData.get("valid_from") ?? "").trim();

  if (!profileId) return { success: false, error: "Terapeuta inválido." };
  if (!tier) return { success: false, error: "Informe o nome da faixa/tier." };
  if (!Number.isFinite(modulePrice) || modulePrice <= 0) {
    return { success: false, error: "Honorário por Módulo Assistencial precisa ser um número maior que zero." };
  }
  if (!Number.isInteger(attendancesPerModule) || attendancesPerModule <= 0) {
    return { success: false, error: "Atendimentos por módulo precisa ser um número inteiro maior que zero." };
  }
  if (!Number.isInteger(docDeadlineDays) || docDeadlineDays <= 0) {
    return { success: false, error: "Prazo de documentação precisa ser um número inteiro de dias maior que zero." };
  }
  if (!Number.isFinite(noshowCompensationPct) || noshowCompensationPct < 0 || noshowCompensationPct > 100) {
    return { success: false, error: "Percentual de indenização por esvaziamento precisa estar entre 0 e 100." };
  }
  if (!validFrom) return { success: false, error: "Informe a data de início desta faixa." };

  const supabase = await createClient();

  const { data: openContract } = await supabase
    .from("therapist_contracts")
    .select("id, valid_from")
    .eq("profile_id", profileId)
    .is("valid_to", null)
    .maybeSingle();

  if (openContract) {
    if (openContract.valid_from >= validFrom) {
      return {
        success: false,
        error: "Já existe uma faixa vigente que começa na mesma data ou depois — ajuste a data de início.",
      };
    }
    const dayBefore = new Date(`${validFrom}T00:00:00`);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const { error: closeError } = await supabase
      .from("therapist_contracts")
      .update({ valid_to: dayBefore.toISOString().slice(0, 10) })
      .eq("id", openContract.id);

    if (closeError) {
      return { success: false, error: "Não foi possível encerrar a faixa anterior." };
    }
  }

  const { error: insertError } = await supabase.from("therapist_contracts").insert({
    profile_id: profileId,
    tier,
    hourly_rate: null,
    module_price: modulePrice,
    attendances_per_module: attendancesPerModule,
    doc_deadline_days: docDeadlineDays,
    noshow_compensation_pct: noshowCompensationPct,
    valid_from: validFrom,
  });

  if (insertError) {
    if (insertError.code === "23P01") {
      return {
        success: false,
        error: "Essa data conflita com outra faixa já cadastrada para este terapeuta.",
      };
    }
    return { success: false, error: "Não foi possível salvar — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/configuracoes/profissionais");
  revalidatePath("/terapeuta/repasse");
  revalidatePath("/gestor/financeiro");
  revalidatePath("/gestor/bonificacao");
  return { success: true };
}
