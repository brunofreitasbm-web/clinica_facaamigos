"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { generateTissXml } from "@/lib/tiss/xml-builder";
import { preValidateTissBatch, hasBlockingIssues, type TissValidationIssue } from "@/lib/tiss/pre-validate";
import { getPendingGuias, getClinicHeaderInfo } from "./data";

type GenerateResult =
  | { success: true; xml: string; filename: string; warnings: TissValidationIssue[] }
  | { success: false; error: string; issues?: TissValidationIssue[] };

type CheckResult = { success: true; issues: TissValidationIssue[] } | { success: false; error: string };

/**
 * Só LEITURA: reconsulta as guias selecionadas e roda a pré-validação
 * (lib/tiss/pre-validate.ts), sem gerar XML nem alterar nada no banco. Serve
 * pra tela mostrar os problemas ANTES de a pessoa decidir exportar (o mesmo
 * cálculo roda de novo dentro de `generateGuiasXml`, que é quem de fato
 * decide bloquear ou não).
 */
export async function checkGuiasTissIssues(billingPeriodId: string, selectedItemIds: string[]): Promise<CheckResult> {
  if (!billingPeriodId || selectedItemIds.length === 0) {
    return { success: true, issues: [] };
  }

  const supabase = await createClient();
  const groups = await getPendingGuias(supabase, DEV_CLINIC_ID);
  const group = groups.find((g) => g.billingPeriodId === billingPeriodId);
  if (!group) {
    return { success: false, error: "Competência não encontrada ou já exportada." };
  }

  const selected = group.guias.filter((g) => selectedItemIds.includes(g.id));
  return { success: true, issues: preValidateTissBatch(selected) };
}

/**
 * Gera o XML TISS de um lote a partir de guias já faturadas
 * (`billing_items` da competência) — reconsulta tudo no servidor a partir de
 * `billingPeriodId`/`selectedItemIds` em vez de confiar no que o client
 * mandou, e marca a competência como `enviada` (mesmo efeito que o CSV do
 * faturista em app/faturamento/competencias/actions.ts, formato diferente).
 *
 * Antes de gerar, roda a pré-validação (lib/tiss/pre-validate.ts) sobre as
 * guias selecionadas: se houver problema `bloqueante` (campo obrigatório
 * vazio, guia vencida/negada/esgotada, evolução não assinada, procedimento
 * fora da tabela de preços do convênio...), NÃO gera o XML nem marca a
 * competência como enviada — devolve a lista de problemas pra UI mostrar.
 * Se só houver `aviso`, quem decide é a pessoa: passe `force: true` pra
 * gerar mesmo assim (os avisos voltam em `warnings` no resultado).
 */
export async function generateGuiasXml(
  billingPeriodId: string,
  selectedItemIds: string[],
  force = false,
): Promise<GenerateResult> {
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

  const issues = preValidateTissBatch(selected);
  if (hasBlockingIssues(issues)) {
    return {
      success: false,
      error: "Lote com problema(s) bloqueante(s) — corrija antes de gerar o XML.",
      issues,
    };
  }
  if (issues.length > 0 && !force) {
    return {
      success: false,
      error: "Lote com aviso(s) de risco de glosa — revise ou confirme o envio mesmo assim.",
      issues,
    };
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
  return { success: true, xml, filename, warnings: issues };
}
