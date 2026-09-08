"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PROTOCOL_CATALOG } from "@/lib/protocol-catalog";
import { getProtocolTemplate } from "@/lib/protocol-templates";
import { seedProtocolFromTemplate } from "@/lib/protocol-templates/seed";

type ActionResult = { success: true; redirectTo?: string } | { success: false; error: string };

/**
 * Cadastro de protocolo (Módulo 3 MAAIS, slides 24-25), em dois modos:
 *
 * - "licenciado" (fluxo original, PRD §9.4-A): quem cadastra assume o risco
 *   de digitização de um instrumento cuja licença a clínica possui. Itens
 *   são digitados um a um depois, em /gestor/cadastros/terapias/[protocolId].
 * - "generic": semeia a estrutura genérica de lib/protocol-templates/ (sem
 *   licença — ver docs/protocolos-genericos-fontes.md). O campo de aceite
 *   de risco passa a registrar a ciência de que é uma estrutura genérica de
 *   autoria própria, não uma reprodução do instrumento licenciado.
 */
export async function createProtocol(formData: FormData): Promise<ActionResult> {
  const mode = String(formData.get("mode") ?? "licensed");
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
    return {
      success: false,
      error:
        mode === "generic"
          ? "É preciso confirmar que esta é uma estrutura genérica de autoria própria para cadastrar."
          : "É preciso confirmar a aceitação do risco de digitização para cadastrar.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  if (mode === "generic") {
    const template = getProtocolTemplate(name);
    if (!template) return { success: false, error: "Este protocolo ainda não tem estrutura genérica disponível." };

    const { data: inserted, error } = await supabase
      .from("protocols")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        name,
        display_name: template.displayName,
        area,
        version: version ?? template.version,
        is_generic: true,
        template_version: template.version,
        scale: template.scale,
        digitization_risk_accepted_by: user.id,
        digitization_risk_accepted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !inserted) {
      if (error?.code === "23505") return { success: false, error: "Este protocolo já está cadastrado nesta clínica." };
      return { success: false, error: "Não foi possível cadastrar o protocolo." };
    }

    const seedResult = await seedProtocolFromTemplate(supabase, inserted.id, template);
    if (!seedResult.success) {
      // Reverte o protocolo criado — sem itens ele ficaria travado no estado
      // "não configurado" sem forma de completar pela UI de importação.
      await supabase.from("protocols").delete().eq("id", inserted.id);
      return { success: false, error: `Não foi possível semear os itens do template: ${seedResult.error}` };
    }

    revalidatePath("/gestor/cadastros/terapias");
    return { success: true, redirectTo: `/gestor/cadastros/terapias/${inserted.id}` };
  }

  const { error } = await supabase.from("protocols").insert({
    clinic_id: DEV_CLINIC_ID,
    name,
    display_name: displayName || null,
    area,
    version,
    is_generic: false,
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
