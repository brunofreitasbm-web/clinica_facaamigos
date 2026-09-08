"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { isNativeInstrumentKey } from "@/lib/native-instruments";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Instrumentos com implementação própria (lib/native-instruments.ts). Não há
 * create nem delete: o catálogo é código, e o gestor só decide se a clínica
 * usa cada um e registra a licença. `clinic_instruments` guarda só isso —
 * ausência de linha significa habilitado (ver lib/clinic-instruments.ts).
 */
async function upsertInstrument(
  instrument: string,
  patch: { enabled?: boolean },
  notFoundMessage: string,
): Promise<ActionResult> {
  if (!isNativeInstrumentKey(instrument)) {
    return { success: false, error: "Instrumento desconhecido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase.from("clinic_instruments").upsert(
    {
      clinic_id: DEV_CLINIC_ID,
      instrument,
      ...patch,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,instrument" },
  );

  if (error) return { success: false, error: notFoundMessage };

  revalidatePath("/gestor/cadastros/instrumentos");
  return { success: true };
}

export async function setInstrumentEnabled(instrument: string, enabled: boolean): Promise<ActionResult> {
  return upsertInstrument(
    instrument,
    { enabled },
    "Você não tem permissão para ativar ou desativar instrumentos.",
  );
}

