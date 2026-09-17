"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPriceTableEntry(
  insurerId: string,
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const procedureCode = String(formData.get("procedure_code") ?? "").trim();
  const procedureName = String(formData.get("procedure_name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const validFrom = String(formData.get("valid_from") ?? "").trim();
  const validTo = String(formData.get("valid_to") ?? "").trim();
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();
  const maxSessionsRaw = String(formData.get("max_sessions_per_guide") ?? "").trim();
  const medicalOrderMonthsRaw = String(formData.get("medical_order_validity_months") ?? "").trim();
  const guideValidityDaysRaw = String(formData.get("guide_validity_days") ?? "").trim();
  const requiresPriorAuthorization = formData.get("requires_prior_authorization") === "on";
  const sessionFrequencyNote = String(formData.get("session_frequency_note") ?? "").trim();
  const escalationRule = String(formData.get("escalation_rule") ?? "").trim();

  if (!procedureCode) {
    return { success: false, error: "Código do procedimento é obrigatório." };
  }

  if (!procedureName) {
    return { success: false, error: "Nome do procedimento é obrigatório." };
  }

  const price = Number(priceRaw.replace(",", "."));
  if (!priceRaw || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: "Preço é obrigatório e deve ser maior que zero." };
  }

  if (!validFrom) {
    return { success: false, error: "Data de início da vigência é obrigatória." };
  }

  const durationMinutes = durationRaw ? Number(durationRaw) : null;
  const maxSessionsPerGuide = maxSessionsRaw ? Number(maxSessionsRaw) : null;
  const medicalOrderValidityMonths = medicalOrderMonthsRaw ? Number(medicalOrderMonthsRaw) : null;
  const guideValidityDays = guideValidityDaysRaw ? Number(guideValidityDaysRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("insurer_price_tables").insert({
    insurer_id: insurerId,
    procedure_code: procedureCode,
    procedure_name: procedureName,
    price,
    valid_from: validFrom,
    valid_to: validTo || null,
    duration_minutes: durationMinutes,
    max_sessions_per_guide: maxSessionsPerGuide,
    medical_order_validity_months: medicalOrderValidityMonths,
    guide_validity_days: guideValidityDays,
    requires_prior_authorization: requiresPriorAuthorization,
    session_frequency_note: sessionFrequencyNote || null,
    escalation_rule: escalationRule || null,
  });

  if (error) {
    return { success: false, error: "Não foi possível salvar o preço. Tente de novo." };
  }

  revalidatePath(`/gestor/cadastros/convenios/${insurerId}/precos`);
  return { success: true };
}

export async function loadDefaultProasaCatalogAction(
  insurerId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: insurer } = await supabase
    .from("insurers")
    .select("name")
    .eq("id", insurerId)
    .maybeSingle();

  if (!insurer) {
    return { success: false, error: "Plano de saúde não encontrado." };
  }

  const { ensureProasaCatalog } = await import("@/lib/proasa-catalog-seeder");
  await ensureProasaCatalog(insurerId, insurer.name);

  revalidatePath(`/gestor/cadastros/convenios/${insurerId}/precos`);
  return { success: true };
}

