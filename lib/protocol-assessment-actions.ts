"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProtocolScale } from "@/lib/protocol-assessments";

type ActionResult = { success: true } | { success: false; error: string };

// Compartilhada entre /terapeuta/paciente/[patientId]/avaliacao (única rota
// que consome hoje) — vive em lib/ em vez de colocada na rota porque é
// dado de protocolo (item 8 do PRD), não específico de sessão, e a RLS de
// protocol_assessments já autoriza terapeuta certificado OU supervisor a
// escrever, então a mesma action está pronta para uma futura rota de
// supervisor sem duplicação.
export async function submitProtocolAssessment(
  patientId: string,
  protocolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  let scores: Record<string, number>;
  try {
    scores = JSON.parse(String(formData.get("scores") ?? "{}"));
  } catch {
    return { success: false, error: "Dados da avaliação inválidos. Recarregue a página e tente de novo." };
  }

  if (Object.keys(scores).length === 0) {
    return { success: false, error: "Pontue pelo menos um item antes de salvar." };
  }

  const { data: protocol } = await supabase.from("protocols").select("scale").eq("id", protocolId).maybeSingle();
  const scale = getProtocolScale(protocol?.scale);
  for (const value of Object.values(scores)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < scale.min || value > scale.max) {
      return { success: false, error: `Pontuação inválida — os valores devem estar entre ${scale.min} e ${scale.max}.` };
    }
  }

  const { error } = await supabase.from("protocol_assessments").insert({
    patient_id: patientId,
    protocol_id: protocolId,
    assessed_by: user.id,
    scores,
  });

  if (error) {
    return {
      success: false,
      error:
        "Não foi possível salvar a avaliação — verifique se você tem certificação/permissão para este protocolo e tente de novo.",
    };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/avaliacao`);
  return { success: true };
}
