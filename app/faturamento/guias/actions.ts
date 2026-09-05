"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { generateTissXml } from "@/lib/tiss/xml-builder";
import { getPendingGuias, getClinicHeaderInfo } from "./data";

type GenerateResult = { success: true; xml: string; filename: string } | { success: false; error: string };

/**
 * Gera o XML TISS de um lote a partir de guias já faturadas
 * (`billing_items` da competência) — reconsulta tudo no servidor a partir de
 * `billingPeriodId`/`selectedItemIds` em vez de confiar no que o client
 * mandou, e marca a competência como `enviada` (mesmo efeito que o CSV do
 * faturista em app/faturamento/competencias/actions.ts, formato diferente).
 */
export async function generateGuiasXml(billingPeriodId: string, selectedItemIds: string[]): Promise<GenerateResult> {
  if (!billingPeriodId || selectedItemIds.length === 0) {
    return { success: false, error: "Selecione ao menos uma guia." };
  }

  const supabase = await createClient();
  const [groups, clinicInfo] = await Promise.all([
    getPendingGuias(supabase, DEV_CLINIC_ID),
    getClinicHeaderInfo(supabase, DEV_CLINIC_ID),
  ]);

  const group = groups.find((g) => g.billingPeriodId === billingPeriodId);
  if (!group) {
    return { success: false, error: "Competência não encontrada ou já exportada." };
  }

  const selected = group.guias.filter((g) => selectedItemIds.includes(g.id));
  if (selected.length === 0) {
    return { success: false, error: "Nenhuma das guias selecionadas foi encontrada." };
  }

  const xml = generateTissXml({
    numeroLote: `LOTE-${billingPeriodId.slice(0, 8).toUpperCase()}`,
    codigoPrestador: group.providerCode ?? "",
    nomePrestador: clinicInfo.nomePrestador,
    cnpjPrestador: clinicInfo.cnpjPrestador,
    registroAns: group.ansCode ?? "",
    dataCriacao: new Date().toISOString(),
    guias: selected,
  });

  const { error } = await supabase
    .from("billing_periods")
    .update({ status: "enviada", exported_at: new Date().toISOString() })
    .eq("id", billingPeriodId);

  if (error) {
    return { success: false, error: "XML gerado, mas não foi possível marcar a competência como exportada." };
  }

  revalidatePath("/faturamento/guias");
  revalidatePath("/faturamento/competencias");

  const filename = `lote-tiss-${group.insurerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${group.competenceLabel.replace("/", "-")}.xml`;
  return { success: true, xml, filename };
}
