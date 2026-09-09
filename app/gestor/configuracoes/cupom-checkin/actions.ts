"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

const TRIGGER_MODES = ["primeiro", "todos", "manual"] as const;
const PAPER_WIDTHS = [58, 80] as const;
const MAX_TEXT_LENGTH = 200;

const BOOLEAN_FIELDS = [
  "show_logo",
  "show_clinic_name",
  "show_patient_name",
  "show_ticket_label",
  "show_checkin_time",
  "show_room",
  "show_discipline",
  "show_therapist",
  "show_time_range",
  "show_warnings",
  "show_printed_at",
] as const;

/**
 * Salva as configurações do cupom de check-in (uma linha por clínica). RLS
 * (checkin_coupon_settings_manage_ins/upd) restringe a gestor.
 */
export async function saveCouponSettings(formData: FormData): Promise<ActionResult> {
  const enabled = formData.get("enabled") === "on";
  const triggerMode = String(formData.get("trigger_mode") ?? "");
  const paperWidthMm = Number(formData.get("paper_width_mm"));
  const headerText = String(formData.get("header_text") ?? "").trim();
  const footerText = String(formData.get("footer_text") ?? "").trim();

  if (!TRIGGER_MODES.includes(triggerMode as (typeof TRIGGER_MODES)[number])) {
    return { success: false, error: "Selecione um gatilho válido." };
  }
  if (!PAPER_WIDTHS.includes(paperWidthMm as (typeof PAPER_WIDTHS)[number])) {
    return { success: false, error: "Selecione uma largura de papel válida (58 ou 80mm)." };
  }
  if (headerText.length > MAX_TEXT_LENGTH) {
    return { success: false, error: `O cabeçalho deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.` };
  }
  if (footerText.length > MAX_TEXT_LENGTH) {
    return { success: false, error: `O rodapé deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const booleanFields = Object.fromEntries(BOOLEAN_FIELDS.map((f) => [f, formData.get(f) === "on"]));

  const { error } = await supabase.from("checkin_coupon_settings").upsert(
    {
      clinic_id: DEV_CLINIC_ID,
      enabled,
      trigger_mode: triggerMode,
      paper_width_mm: paperWidthMm,
      header_text: headerText,
      footer_text: footerText,
      ...booleanFields,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" },
  );

  if (error) {
    return { success: false, error: "Não foi possível salvar — verifique se você tem permissão de gestor." };
  }

  revalidatePath("/gestor/configuracoes/cupom-checkin");
  return { success: true };
}
