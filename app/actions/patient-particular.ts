"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { success: true } | { success: false; error: string };

function revalidateEverywhere(patientId: string) {
  revalidatePath("/recepcao", "layout");
  revalidatePath(`/terapeuta/paciente/${patientId}`);
  revalidatePath("/supervisao/prontuario-unificado");
}

/**
 * "É particular": para o paciente cujo plano não foi identificado, marca como
 * Particular (patient_insurance.is_private = true). Só vale quando NÃO há convênio
 * identificado: nunca troca um convênio real por Particular. A RLS de
 * patient_insurance já restringe a escrita a recepção/supervisão/gestão.
 *
 * `particular = false` desfaz a marcação (volta a "não identificado") e só mexe
 * em linhas is_private; linhas com autorização vinculada ficam e o erro é devolvido.
 */
export async function setPatientParticular(patientId: string, particular: boolean): Promise<Result> {
  if (!patientId) return { success: false, error: "Paciente não informado." };
  const supabase = await createClient();

  const { data: rows, error: readError } = await supabase
    .from("patient_insurance")
    .select("id, insurer_id, is_private")
    .eq("patient_id", patientId);
  if (readError) return { success: false, error: "Não foi possível ler o plano do paciente. Tente de novo." };

  const current = rows ?? [];

  if (particular) {
    if (current.some((r) => !r.is_private && r.insurer_id)) {
      return { success: false, error: "Este paciente já tem plano de saúde. Troque o plano na ficha do paciente." };
    }
    if (current.some((r) => r.is_private)) {
      revalidateEverywhere(patientId);
      return { success: true };
    }
    const unidentified = current[0];
    const { data, error } = unidentified
      ? await supabase
          .from("patient_insurance")
          .update({ is_private: true, insurer_id: null })
          .eq("id", unidentified.id)
          .select("id")
      : await supabase
          .from("patient_insurance")
          .insert({ patient_id: patientId, insurer_id: null, is_private: true })
          .select("id");
    if (error || !data?.length) {
      return { success: false, error: "Sem permissão ou falha ao marcar como particular. Peça à recepção." };
    }
  } else {
    const privateIds = current.filter((r) => r.is_private).map((r) => r.id);
    if (privateIds.length) {
      const { error } = await supabase.from("patient_insurance").delete().in("id", privateIds);
      if (error) {
        return {
          success: false,
          error: "Não foi possível desfazer: há guia vinculada. Ajuste o plano na ficha do paciente.",
        };
      }
    }
  }

  revalidateEverywhere(patientId);
  return { success: true };
}
