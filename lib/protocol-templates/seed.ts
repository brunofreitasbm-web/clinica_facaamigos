import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ProtocolTemplate } from "./types";

type Supa = SupabaseClient<Database>;

/**
 * Insere em lote todos os itens de um template genérico dentro de um
 * protocolo já criado. Preserva a ordem do template em `sort_order` (a UI de
 * avaliação e o cadastro passam a ordenar por ele em vez de alfabética).
 * Não faz upsert: assume protocolo recém-criado sem itens.
 */
export async function seedProtocolFromTemplate(
  supabase: Supa,
  protocolId: string,
  template: ProtocolTemplate,
): Promise<{ success: true; itemCount: number } | { success: false; error: string }> {
  const rows: Database["public"]["Tables"]["protocol_items"]["Insert"][] = [];
  let sortOrder = 0;
  for (const d of template.domains) {
    for (const item of d.items) {
      rows.push({
        protocol_id: protocolId,
        domain: d.domain,
        level: d.level ?? null,
        item_code: item.code,
        description: item.description,
        weight: item.weight ?? 1,
        inverted: item.inverted ?? false,
        sort_order: sortOrder++,
      });
    }
  }

  if (rows.length === 0) return { success: false, error: "Template sem itens." };

  const { error } = await supabase.from("protocol_items").insert(rows);
  if (error) return { success: false, error: error.message };

  return { success: true, itemCount: rows.length };
}
