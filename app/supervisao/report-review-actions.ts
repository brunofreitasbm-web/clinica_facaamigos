"use server";

import { revalidatePath } from "next/cache";
import { approveDevolutionReport } from "@/app/terapeuta/paciente/[patientId]/relatorio/actions";

/**
 * Wrapper fino: reaproveita a mesma aprovação já usada na tela do terapeuta
 * (draft_reports.status -> 'aprovado') pra que a supervisão também possa
 * validar o relatório devolutivo direto da caixa de entrada, sem duplicar a
 * regra de negócio.
 */
export async function approveReportFromSupervisao(
  patientId: string,
  reportId: string,
  finalText: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await approveDevolutionReport(patientId, reportId, finalText);
  if (result.success) revalidatePath("/supervisao");
  return result;
}
