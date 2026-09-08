"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

export async function createProtocolItem(protocolId: string, formData: FormData): Promise<ActionResult> {
  const domain = String(formData.get("domain") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const itemCode = String(formData.get("item_code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!domain) {
    return { success: false, error: "Domínio é obrigatório." };
  }
  if (!itemCode) {
    return { success: false, error: "Código do item é obrigatório." };
  }
  if (!description) {
    return { success: false, error: "Descrição é obrigatória." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("protocol_items").insert({
    protocol_id: protocolId,
    domain,
    level: level || null,
    item_code: itemCode,
    description,
  });

  if (error) {
    return {
      success: false,
      error: "Não foi possível salvar o item. Verifique se você tem permissão (gestor ou supervisor) e tente de novo.",
    };
  }

  revalidatePath(`/gestor/cadastros/terapias/${protocolId}`);
  revalidatePath("/gestor/cadastros/protocolos");
  return { success: true };
}

export async function deleteProtocolItem(protocolId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("protocol_items").delete().eq("id", itemId);

  if (error) {
    return { success: false, error: "Não foi possível remover o item. Tente de novo." };
  }

  revalidatePath(`/gestor/cadastros/terapias/${protocolId}`);
  revalidatePath("/gestor/cadastros/protocolos");
  return { success: true };
}

const LINE_BREAK = /\r\n|\r|\n/;
const FIELD_SEP = /;|\t/;

/**
 * Importação em massa — cada linha colada é "domínio;nível;código;descrição"
 * (nível pode ficar vazio: "domínio;;código;descrição"), separador ; ou tab
 * (cola direto de planilha). Complementa os templates genéricos (item 1 do
 * plano de protocolos genéricos), que só trazem um subconjunto representativo
 * de instrumentos com centenas de itens reais (ABLLS-R, ESDM, IPO, AFLS) — o
 * gestor cola o restante do material que a clínica possui.
 */
export async function importProtocolItems(
  protocolId: string,
  rawText: string,
): Promise<ActionResult & { itemCount?: number }> {
  const lines = rawText
    .split(LINE_BREAK)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: false, error: "Cole ao menos uma linha no formato domínio;nível;código;descrição." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("protocol_items")
    .select("sort_order")
    .eq("protocol_id", protocolId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const rows: {
    protocol_id: string;
    domain: string;
    level: string | null;
    item_code: string;
    description: string;
    sort_order: number;
  }[] = [];

  for (const [i, line] of lines.entries()) {
    const parts = line.split(FIELD_SEP).map((p) => p.trim());
    if (parts.length < 4) {
      return { success: false, error: `Linha ${i + 1} inválida — use domínio;nível;código;descrição (nível pode ficar vazio).` };
    }
    const [domain, level, itemCode, ...descParts] = parts;
    const description = descParts.join(" ").trim();
    if (!domain || !itemCode || !description) {
      return { success: false, error: `Linha ${i + 1} tem campo obrigatório vazio (domínio, código e descrição são obrigatórios).` };
    }
    rows.push({ protocol_id: protocolId, domain, level: level || null, item_code: itemCode, description, sort_order: sortOrder++ });
  }

  const { error } = await supabase.from("protocol_items").insert(rows);
  if (error) {
    return {
      success: false,
      error: "Não foi possível importar os itens. Verifique se você tem permissão (gestor ou supervisor) e tente de novo.",
    };
  }

  revalidatePath(`/gestor/cadastros/terapias/${protocolId}`);
  revalidatePath("/gestor/cadastros/protocolos");
  return { success: true, itemCount: rows.length };
}
