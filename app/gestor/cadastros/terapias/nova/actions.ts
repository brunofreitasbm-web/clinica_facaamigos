"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PROTOCOL_CATALOG } from "@/lib/protocol-catalog";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cadastro de protocolo licenciado (Módulo 3 MAAIS, slides 24-25). Mantém a
 * exigência jurídica que já existia (PRD §9.4-A): quem cadastra assume
 * explicitamente o risco de digitização — antes isso só era possível via
 * seed manual porque não havia UI de criação nesta tela.
 */
export async function createProtocol(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim() || null;
  const version = String(formData.get("version") ?? "").trim() || null;
  const licensePurchasedAt = String(formData.get("license_purchased_at") ?? "").trim() || null;
  const riskAccepted = formData.get("risk_accepted") === "on";

  if (!name || !PROTOCOL_CATALOG.some((p) => p.name === name)) {
    return { success: false, error: "Selecione um protocolo válido da lista." };
  }
  if (!riskAccepted) {
    return { success: false, error: "É preciso confirmar a aceitação do risco de digitização para cadastrar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase.from("protocols").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    display_name: displayName || null,
    area,
    version,
    license_purchased_at: licensePurchasedAt,
    digitization_risk_accepted_by: user.id,
    digitization_risk_accepted_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { success: false, error: "Este protocolo já está cadastrado nesta clínica." };
    return { success: false, error: "Não foi possível cadastrar o protocolo." };
  }

  revalidatePath("/gestor/cadastros/terapias");
  return { success: true };
}
