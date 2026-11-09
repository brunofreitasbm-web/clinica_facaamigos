// lib/atendimento/load-senders.ts
// Quem da equipe enviou cada mensagem da conversa (id da mensagem → id do profissional).
// Cliente (navegador): usado pelo chat do desktop e do celular.
//
// `sent_by` é lido À PARTE do select principal de mensagens de propósito: se a migration que cria
// a coluna (20261109130000_messages_sent_by.sql) ainda não foi aplicada, um select com ela
// quebraria o histórico inteiro. Aqui qualquer falha vira mapa vazio e a tela só perde o rótulo.

import { createClient } from "@/lib/supabase/client";

export async function loadSenders(conversationId: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await createClient()
      .from("messages")
      .select("id, sent_by")
      .eq("conversation_id", conversationId)
      .not("sent_by", "is", null);
    if (error || !data) return {};
    const map: Record<string, string> = {};
    for (const row of data as { id: string; sent_by: string | null }[]) {
      if (row.sent_by) map[row.id] = row.sent_by;
    }
    return map;
  } catch {
    return {};
  }
}
