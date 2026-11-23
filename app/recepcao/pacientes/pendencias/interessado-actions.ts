"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { promoteToPatient } from "@/lib/patient-stage";
import { setPatientParticular } from "@/app/actions/patient-particular";

type Result = { success: true } | { success: false; error: string };

/**
 * Interessado cadastrado à mão que paga sem plano: marca como Particular e já
 * o promove a "avaliação" (sem guia a esperar, não há motivo para ele seguir
 * escondido de Pacientes e da Agenda de 1ª avaliação).
 */
export async function markInteressadoParticular(patientId: string): Promise<Result> {
  const res = await setPatientParticular(patientId, true);
  if (!res.success) return res;
  const supabase = await createClient();
  await promoteToPatient(supabase, patientId);
  revalidatePath("/recepcao", "layout");
  revalidatePath("/supervisao");
  return { success: true };
}
