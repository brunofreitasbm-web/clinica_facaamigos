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
  patch: { enabled?: boolean; license_purchased_at?: string | null; license_note?: string | null },
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

  // upsert em vez de insert/update separados: a linha só passa a existir
  // quando o gestor mexe pela primeira vez, e `unique (clinic_id, instrument)`
  // é o alvo do conflito.
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

export async function saveInstrumentLicense(instrument: string, formData: FormData): Promise<ActionResult> {
  const rawDate = String(formData.get("license_purchased_at") ?? "").slice(0, 10);
  if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { success: false, error: "Data de compra inválida." };
  }
  const note = String(formData.get("license_note") ?? "").trim();

  return upsertInstrument(
    instrument,
    { license_purchased_at: rawDate || null, license_note: note || null },
    "Não foi possível salvar os dados de licença deste instrumento.",
  );
}
