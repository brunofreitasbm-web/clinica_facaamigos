"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Gira o cartaz: revoga o token ativo e cria um novo. Usado se o link vazar
 * (F10 do plano — QR fotografado/repassado) ou se o cartaz físico precisar
 * ser reimpresso do zero. A RLS (clinic_checkin_tokens_insert/_update,
 * 20260908040000) já restringe isso a `gestor` — não duplicamos a checagem
 * aqui, só traduzimos a negação em mensagem amigável.
 */
export async function rotateCheckinToken(): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: revokeError } = await supabase
    .from("clinic_checkin_tokens")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true);

  if (revokeError) {
    return { success: false, error: "Só o gestor pode girar o cartaz de check-in." };
  }

  const { error: insertError } = await supabase
    .from("clinic_checkin_tokens")
    .insert({ clinic_id: DEV_CLINIC_ID, label: "Cartaz da entrada" });

  if (insertError) {
    return { success: false, error: "Não foi possível gerar o novo cartaz." };
  }

  revalidatePath("/recepcao/recursos/qr-checkin");
  return { success: true };
}
