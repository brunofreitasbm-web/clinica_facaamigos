// lib/closed-chat-filter.ts
// Cruza a fila de Autorizações com o chat: tira o lead cuja conversa já foi encerrada
// e que não tem guia andando (regra em lib/closed-chat-filter-pure.ts). Usado pela
// página Autorizações e pelo contador do menu, para os dois baterem.
import type { createClient } from "@/lib/supabase/server";
import type { PendingQueueItem } from "@/lib/reception-queue";
import { isHiddenByClosedChat, phonesWithOnlyClosedChats } from "@/lib/closed-chat-filter-pure";

type Supa = Awaited<ReturnType<typeof createClient>>;

export async function dropLeadsWithClosedChat(
  supabase: Supa,
  items: PendingQueueItem[],
): Promise<{ visible: PendingQueueItem[]; hiddenCount: number }> {
  const phones = [...new Set(items.map((i) => i.draft?.sourcePhone).filter((p): p is string => Boolean(p)))];
  if (phones.length === 0) return { visible: items, hiddenCount: 0 };
  const { data } = await supabase.from("twilio_conversations").select("phone_number, status").in("phone_number", phones);
  const closedPhones = phonesWithOnlyClosedChats(data ?? []);
  const visible = items.filter((item) => !isHiddenByClosedChat(item.draft, closedPhones));
  return { visible, hiddenCount: items.length - visible.length };
}
