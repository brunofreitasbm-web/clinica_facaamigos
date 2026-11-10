// lib/fila/load-fila.ts
// Carrega a Fila de entrada para a página (servidor). Mesma fonte de Autorizações: lead do WhatsApp sem
// prontuário (mais os devolvidos pela Supervisão), sem os de conversa já encerrada e sem guia andando.

import type { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getReceptionQueue, isAuthorizationQueueItem } from "@/lib/reception-queue";
import { dropLeadsWithClosedChat } from "@/lib/closed-chat-filter";
import { buildFilaItems } from "./fila-source";
import type { FilaItem } from "./fila-model-pure";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type FilaData = {
  items: FilaItem[];
  /** Famílias ocultas por terem a conversa encerrada (voltam sozinhas se a família escrever de novo). */
  hiddenCount: number;
  owners: { id: string; full_name: string }[];
  userId: string | null;
};

export async function loadFila(supabase: Supa): Promise<FilaData> {
  const queue = (await getReceptionQueue(supabase)).filter(isAuthorizationQueueItem);
  const { visible, hiddenCount } = await dropLeadsWithClosedChat(supabase, queue);

  const [{ data: owners }, { data: auth }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("active", true)
      .in("role", ["recepcao", "supervisor", "gestor"])
      .order("full_name", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  return {
    items: buildFilaItems(visible, Date.now()),
    hiddenCount,
    owners: owners ?? [],
    userId: auth.user?.id ?? null,
  };
}
