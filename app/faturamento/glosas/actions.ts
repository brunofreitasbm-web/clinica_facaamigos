"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };
type CreateGlosaResult =
  | { success: true; glosaId: string }
  | { success: false; error: string };
type ImportCsvResult =
  | {
      success: true;
      processed: number;
      skipped: { line: number; guide: string; reason: string }[];
    }
  | { success: false; error: string };

const ATTRIBUTABLE_VALUES = ["terapeuta", "recepcao", "faturamento", "operadora"] as const;
type Attributable = (typeof ATTRIBUTABLE_VALUES)[number];

function isAttributable(value: string): value is Attributable {
  return (ATTRIBUTABLE_VALUES as readonly string[]).includes(value);
}

function formatCurrencyBrl(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * O update de `billing_items.status` depois do insert em `glosas` exige a
 * mesma permissão de RLS (faturamento/gestor + escopo de clínica) que já
 * validamos no insert — por isso, se falhar aqui, só logamos: reverter o
 * insert exigiria uma segunda operação com a mesma permissão que acabou de
 * falhar, então não haveria diferença prática de segurança em não reverter.
 */
async function markBillingItemStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  billingItemId: string,
  status: "glosado" | "recursado" | "recuperado",
) {
  const { error } = await supabase.from("billing_items").update({ status }).eq("id", billingItemId);
  if (error) {
    console.error(
      `Falha ao atualizar billing_items.status para '${status}' (item ${billingItemId}):`,
      error.message,
    );
  }
}

/**
 * Registra uma glosa manual sobre um `billing_item` já exportado ('enviado')
 * e marca o item como 'glosado'. A elegibilidade (status='enviado') é
 * reverificada aqui — não confia só na busca que preencheu o formulário — e
 * a RLS de `glosas_write`/`billing_items_update` é o portão real de permissão
 * e escopo de clínica: se o item não pertencer à clínica do usuário, o
 * `.maybeSingle()` abaixo simplesmente não encontra nada.
 */
export async function createGlosa(formData: FormData): Promise<CreateGlosaResult> {
  const billingItemId = String(formData.get("billing_item_id") ?? "").trim();
  const reasonCode = String(formData.get("reason_code") ?? "").trim();
  const reasonText = String(formData.get("reason_text") ?? "").trim();
  const attributableToRaw = String(formData.get("attributable_to") ?? "").trim();
  const attributableProfileId = String(formData.get("attributable_profile_id") ?? "").trim();
  const amount = Number(formData.get("amount"));

  if (!billingItemId) {
    return { success: false, error: "Selecione um item de faturamento na busca." };
  }
  if (!reasonCode) {
    return { success: false, error: "Informe o código do motivo da glosa." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Informe um valor de glosa válido." };
  }
  if (!isAttributable(attributableToRaw)) {
    return { success: false, error: "Selecione a quem atribuir a glosa." };
  }
  if (attributableToRaw === "terapeuta" && !attributableProfileId) {
    return { success: false, error: "Selecione o terapeuta responsável." };
  }

  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("billing_items")
    .select("id, amount, status")
    .eq("id", billingItemId)
    .eq("status", "enviado")
    .maybeSingle();

  if (itemError || !item) {
    return {
      success: false,
      error: "Item não encontrado ou não está mais elegível para glosa (precisa estar com status 'enviado').",
    };
  }
  if (amount > Number(item.amount)) {
    return {
      success: false,
      error: `Valor da glosa não pode ser maior que o valor do item (${formatCurrencyBrl(Number(item.amount))}).`,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("glosas")
    .insert({
      billing_item_id: billingItemId,
      reason_code: reasonCode,
      reason_text: reasonText || null,
      attributable_to: attributableToRaw,
      attributable_profile_id: attributableToRaw === "terapeuta" ? attributableProfileId : null,
      amount,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      success: false,
      error: "Não foi possível registrar a glosa. Verifique sua permissão de faturamento.",
    };
  }

  await markBillingItemStatus(supabase, billingItemId, "glosado");

  revalidatePath("/faturamento/glosas");
  return { success: true, glosaId: inserted.id };
}

/** Marca uma glosa já registrada como recursada (`appealed_at=now()`). */
export async function markAppealed(glosaId: string): Promise<ActionResult> {
  if (!glosaId) return { success: false, error: "Glosa inválida." };

  const supabase = await createClient();

  const { data: glosa } = await supabase
    .from("glosas")
    .select("id, billing_item_id, appealed_at")
    .eq("id", glosaId)
    .maybeSingle();

  if (!glosa) return { success: false, error: "Glosa não encontrada." };
  if (glosa.appealed_at) return { success: false, error: "Esta glosa já foi marcada como recursada." };

  const { error } = await supabase
    .from("glosas")
    .update({ appealed_at: new Date().toISOString() })
    .eq("id", glosaId);

  if (error) {
    return { success: false, error: "Não foi possível marcar a glosa como recursada. Verifique sua permissão." };
  }

  await markBillingItemStatus(supabase, glosa.billing_item_id, "recursado");

  revalidatePath("/faturamento/glosas");
  return { success: true };
}

/** Registra o valor recuperado de uma glosa já recursada. */
export async function registerRecovery(glosaId: string, formData: FormData): Promise<ActionResult> {
  if (!glosaId) return { success: false, error: "Glosa inválida." };

  const recoveredAmount = Number(formData.get("recovered_amount"));
  if (!Number.isFinite(recoveredAmount) || recoveredAmount <= 0) {
    return { success: false, error: "Informe um valor de recuperação válido." };
  }

  const supabase = await createClient();

  const { data: glosa } = await supabase
    .from("glosas")
    .select("id, billing_item_id, amount, recovered_amount")
    .eq("id", glosaId)
    .maybeSingle();

  if (!glosa) return { success: false, error: "Glosa não encontrada." };
  if (glosa.recovered_amount !== null) {
    return { success: false, error: "Esta glosa já teve recuperação registrada." };
  }
  if (recoveredAmount > Number(glosa.amount)) {
    return {
      success: false,
      error: `Valor recuperado não pode ser maior que o valor da glosa (${formatCurrencyBrl(Number(glosa.amount))}).`,
    };
  }

  const { error } = await supabase
    .from("glosas")
    .update({ recovered_amount: recoveredAmount })
    .eq("id", glosaId);

  if (error) {
    return { success: false, error: "Não foi possível registrar a recuperação. Verifique sua permissão." };
  }

  await markBillingItemStatus(supabase, glosa.billing_item_id, "recuperado");

  revalidatePath("/faturamento/glosas");
  return { success: true };
}

/**
 * `123,45` (vírgula BR, com ou sem separador de milhar em ponto) ou
 * `123.45` (ponto já como decimal) — cobre os dois formatos mais prováveis
 * de vir num CSV de retorno de convênio.
 */
function parseAmountFlexible(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseCsvLine(line: string): string[] {
  return line.split(";").map((field) => field.trim().replace(/^"|"$/g, ""));
}

/**
 * Importa um CSV `Guia;Valor;Motivo` (separado por `;`) do retorno de um
 * convênio. Cada linha é casada por `authorizations.guide_number` num
 * `billing_item` ainda 'enviado'. Uma guia pode cobrir várias sessões
 * autorizadas — se o casamento não for único (nenhum item ou mais de um),
 * a linha cai em "não processadas" pro faturista tratar manualmente, em vez
 * de arriscar glosar o item errado. Toda glosa importada por CSV é
 * atribuída a `attributable_to='operadora'` (é a decisão do convênio no
 * lote de retorno) — sem forma de indicar terapeuta/recepção/faturamento
 * pelas 3 colunas mínimas do CSV.
 */
export async function importGlosasCsv(formData: FormData): Promise<ImportCsvResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione um arquivo CSV." };
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { success: false, error: "Arquivo CSV vazio." };
  }

  const firstFields = parseCsvLine(lines[0]).map((f) => f.toLowerCase());
  const startIndex = firstFields[0] === "guia" ? 1 : 0;

  const supabase = await createClient();
  const skipped: { line: number; guide: string; reason: string }[] = [];
  let processed = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const lineNumber = i + 1;
    const [guide, valorRaw, motivo] = parseCsvLine(lines[i]);

    if (!guide) {
      skipped.push({ line: lineNumber, guide: "", reason: "Linha sem número de guia." });
      continue;
    }
    const amount = parseAmountFlexible(valorRaw ?? "");
    if (amount === null || amount <= 0) {
      skipped.push({ line: lineNumber, guide, reason: "Valor inválido." });
      continue;
    }

    const { data: matches, error: matchError } = await supabase
      .from("billing_items")
      .select("id, amount, appointments!inner(authorizations!inner(guide_number))")
      .eq("status", "enviado")
      .eq("appointments.authorizations.guide_number", guide);

    if (matchError) {
      skipped.push({ line: lineNumber, guide, reason: "Erro ao buscar item correspondente." });
      continue;
    }
    if (!matches || matches.length === 0) {
      skipped.push({ line: lineNumber, guide, reason: "Nenhum item 'enviado' encontrado para esta guia." });
      continue;
    }
    if (matches.length > 1) {
      skipped.push({
        line: lineNumber,
        guide,
        reason: "Guia corresponde a mais de um item enviado — trate manualmente.",
      });
      continue;
    }

    const item = matches[0];
    const clampedAmount = Math.min(amount, Number(item.amount));

    const { error: insertError } = await supabase.from("glosas").insert({
      billing_item_id: item.id,
      reason_code: "CSV",
      reason_text: motivo || null,
      attributable_to: "operadora",
      amount: clampedAmount,
    });

    if (insertError) {
      skipped.push({ line: lineNumber, guide, reason: "Não foi possível gravar a glosa (permissão)." });
      continue;
    }

    await markBillingItemStatus(supabase, item.id, "glosado");
    processed++;
  }

  revalidatePath("/faturamento/glosas");
  return { success: true, processed, skipped };
}
