"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { parseRemittanceFile, normalizeCompetence } from "@/lib/insurance-remittance-parser";
import { USUAL_PAYABLES, suggestedDueDate } from "@/lib/usual-payables";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

const DRE_PATH = "/gestor/financeiro/dre";

function revalidateFinanceiro() {
  revalidatePath(DRE_PATH);
  revalidatePath("/gestor/financeiro/contas-a-pagar");
}

/**
 * Recebe a nota do plano, reconhece as linhas em lib/insurance-remittance-parser
 * e grava o resultado. Nada é gravado quando a leitura falha — o gestor vê o
 * erro, não um lote vazio ou estimado.
 */
export async function uploadRemittanceNote(formData: FormData): Promise<
  ActionResult<{ batchId: string; lineCount: number; totalNet: number; warnings: string[] }>
> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione o arquivo da nota (PDF, CSV ou XLSX)." };
  }

  const insurerId = String(formData.get("insurerId") ?? "").trim() || null;
  const competenceInput = normalizeCompetence(formData.get("competenceMonth"));
  const consolidateAll = formData.get("consolidateAll") === "on";

  const supabase = await createClient();

  let insurerName: string | null = null;
  if (insurerId) {
    const { data: insurer } = await supabase.from("insurers").select("name").eq("id", insurerId).maybeSingle();
    insurerName = insurer?.name ?? null;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const parsed = await parseRemittanceFile(
    { name: file.name, bytes },
    { insurerName, competenceMonth: competenceInput },
  );
  if (!parsed.success) return { success: false, error: parsed.error };

  const { result } = parsed;
  if (result.lines.length === 0) {
    const detail = result.warnings[0] ? ` ${result.warnings[0]}` : "";
    return { success: false, error: `Nenhuma linha de recebível foi reconhecida no arquivo.${detail}` };
  }

  const competenceMonth = competenceInput ?? result.competenceMonth;
  if (!competenceMonth) {
    return {
      success: false,
      error: "Não foi possível identificar a competência do arquivo — selecione o mês de competência antes de enviar.",
    };
  }
  const competenceDate = `${competenceMonth}-01`;

  const { data: batch, error: batchError } = await supabase
    .from("insurance_remittance_batches")
    .insert({
      clinic_id: DEV_CLINIC_ID,
      insurer_id: insurerId,
      insurer_name: insurerName ?? result.detectedInsurer,
      file_name: file.name,
      competence_month: competenceDate,
      line_count: result.lines.length,
      total_gross: result.totals.gross,
      total_glosa: result.totals.glosa,
      total_net: result.totals.net,
      warnings: result.warnings,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { success: false, error: "Não foi possível salvar a nota — verifique se você tem permissão de gestor." };
  }

  const { error: linesError } = await supabase.from("insurance_remittance_lines").insert(
    result.lines.map((line) => ({
      batch_id: batch.id,
      clinic_id: DEV_CLINIC_ID,
      competence_month: competenceDate,
      guide_number: line.guideNumber,
      patient_name: line.patientName,
      procedure_code: line.procedureCode,
      sessions: line.sessions,
      gross_amount: line.grossAmount,
      glosa_amount: line.glosaAmount,
      net_amount: line.netAmount,
      service_date: line.serviceDate,
      low_confidence: line.lowConfidence,
      raw_line: line.raw,
      // Linha de baixa confiança nunca entra consolidada de largada, mesmo com
      // "consolidar tudo" marcado: coluna de valor pode estar trocada.
      consolidated: consolidateAll && !line.lowConfidence,
    })),
  );

  if (linesError) {
    // Sem as linhas o lote é uma casca — remove para não deixar meia nota gravada.
    await supabase.from("insurance_remittance_batches").delete().eq("id", batch.id);
    return { success: false, error: "A nota foi lida, mas não foi possível gravar as linhas. Tente novamente." };
  }

  revalidateFinanceiro();
  return {
    success: true,
    batchId: batch.id,
    lineCount: result.lines.length,
    totalNet: result.totals.net,
    warnings: result.warnings,
  };
}

/** Checkbox de uma linha: entra ou sai da receita da DRE. */
export async function setLineConsolidated(lineId: string, consolidated: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("insurance_remittance_lines").update({ consolidated }).eq("id", lineId);
  if (error) return { success: false, error: "Não foi possível atualizar a linha." };
  revalidateFinanceiro();
  return { success: true };
}

/** Marca/desmarca a nota inteira de uma vez. */
export async function setBatchConsolidated(batchId: string, consolidated: boolean): Promise<ActionResult<{ updated: number }>> {
  const supabase = await createClient();
  const query = supabase.from("insurance_remittance_lines").update({ consolidated }).eq("batch_id", batchId);
  // Ao marcar tudo, as linhas de baixa confiança ficam de fora e continuam
  // dependendo de conferência manual; ao desmarcar, todas saem.
  const { data, error } = consolidated
    ? await query.eq("low_confidence", false).select("id")
    : await query.select("id");
  if (error) return { success: false, error: "Não foi possível atualizar a nota." };
  revalidateFinanceiro();
  return { success: true, updated: data?.length ?? 0 };
}

export async function deleteRemittanceBatch(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("insurance_remittance_batches").delete().eq("id", batchId);
  if (error) return { success: false, error: "Não foi possível excluir a nota." };
  revalidateFinanceiro();
  return { success: true };
}

/**
 * Lançamento rápido do quadro de contas a pagar: o gestor digita o valor no
 * item do catálogo (lib/usual-payables.ts) e dá Enter. Só o valor vem do
 * usuário — rótulo, categoria e vencimento sugerido saem do catálogo.
 */
export async function createUsualExpense(input: {
  key: string;
  amount: number;
  competenceMonth: string;
  dueDate?: string | null;
}): Promise<ActionResult<{ description: string; dueDate: string }>> {
  const item = USUAL_PAYABLES.find((entry) => entry.key === input.key);
  if (!item) return { success: false, error: "Conta não reconhecida no catálogo." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: "Informe um valor maior que zero." };
  }
  const competenceMonth = normalizeCompetence(input.competenceMonth);
  if (!competenceMonth) return { success: false, error: "Competência inválida." };

  const dueDate =
    input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : suggestedDueDate(competenceMonth, item.dueDay);
  const [year, month] = competenceMonth.split("-");
  const competenceLabel = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const description = `${item.label} — ${competenceLabel}`;

  const supabase = await createClient();
  const { error } = await supabase.from("accounts_payable").insert({
    clinic_id: DEV_CLINIC_ID,
    category: item.category,
    description,
    amount: input.amount,
    due_date: dueDate,
    recurring: item.recurring,
    notes: item.hint ?? null,
  });

  if (error) {
    return { success: false, error: "Não foi possível lançar a despesa — verifique se você tem permissão de gestor." };
  }

  revalidateFinanceiro();
  return { success: true, description, dueDate };
}
