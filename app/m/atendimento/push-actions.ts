"use server";

import { createClient } from "@/lib/supabase/server";
import { getAtendimentoAccess } from "@/lib/atendimento/load-data";

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

export async function savePushSubscription(input: PushSubscriptionInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { userId, allowed } = await getAtendimentoAccess(supabase);
  if (!userId || !allowed) return { error: "Sem permissão." };
  if (!input.endpoint || !input.p256dh || !input.auth) return { error: "Inscrição inválida." };

  // Aparelho que troca de usuário: a linha antiga (outro user_id) não é
  // visível pela RLS, então apaga via upsert por endpoint só quando é dono.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: "Não foi possível ativar as notificações." };
  return {};
}

export async function removePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { userId, allowed } = await getAtendimentoAccess(supabase);
  if (!userId || !allowed) return { error: "Sem permissão." };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
  if (error) return { error: "Não foi possível desativar." };
  return {};
}
