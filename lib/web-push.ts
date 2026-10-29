import webpush from "web-push";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { PUSH_DEBOUNCE_MS, selectPushUserIds, shouldNotify } from "@/lib/atendimento/push-targets";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@facaamigos.com.br", pub, priv);
  configured = true;
  return true;
}

/**
 * Avisa a equipe (push no PWA /m/atendimento) que há mensagem esperando
 * resposta humana. Nunca lança: falha de push não pode derrubar o
 * processamento da mensagem do WhatsApp. O texto NÃO leva o corpo da
 * mensagem (aparece na tela bloqueada — dado de saúde).
 */
export async function notifyStaffOfConversation(conversationId: string): Promise<void> {
  try {
    if (!configure()) return;
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: conv } = await supabase
      .from("twilio_conversations")
      .select("id, is_bot_active, assigned_to, last_push_at, contact_name, patients(full_name), guardians(full_name)")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return;

    const { data: settings } = await supabase
      .from("chatbot_settings")
      .select("bot_enabled")
      .eq("clinic_id", DEV_CLINIC_ID)
      .maybeSingle();

    const now = new Date();
    if (
      !shouldNotify({
        botActive: conv.is_bot_active,
        botEnabled: settings?.bot_enabled ?? true,
        lastPushAt: conv.last_push_at,
        now,
      })
    ) {
      return;
    }

    // Reserva atômica do debounce: só quem conseguir atualizar envia.
    const threshold = new Date(now.getTime() - PUSH_DEBOUNCE_MS).toISOString();
    const { data: claimed } = await supabase
      .from("twilio_conversations")
      .update({ last_push_at: now.toISOString() })
      .eq("id", conversationId)
      .or(`last_push_at.is.null,last_push_at.lt.${threshold}`)
      .select("id");
    if (!claimed || claimed.length === 0) return;

    const { data: subs } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
    if (!subs || subs.length === 0) return;

    const targetIds = new Set(
      selectPushUserIds({ assignedTo: conv.assigned_to, subscribedUserIds: subs.map((s) => s.user_id) }),
    );
    const patient = Array.isArray(conv.patients) ? conv.patients[0] : conv.patients;
    const guardian = Array.isArray(conv.guardians) ? conv.guardians[0] : conv.guardians;
    const fullName = conv.contact_name || guardian?.full_name || patient?.full_name || "";
    const firstName = fullName.trim().split(/\s+/)[0];
    const payload = JSON.stringify({
      title: "Nova mensagem",
      body: firstName ? `${firstName} aguarda resposta` : "Uma conversa aguarda resposta",
      conversationId,
      url: `/m/atendimento/${conversationId}`,
    });

    await Promise.all(
      subs
        .filter((s) => targetIds.has(s.user_id))
        .map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              TTL: 60 * 60,
              urgency: "high",
            });
            await supabase.from("push_subscriptions").update({ last_success_at: now.toISOString() }).eq("id", s.id);
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", s.id);
            } else {
              console.error("[Web Push] falha ao enviar:", status ?? err);
            }
          }
        }),
    );
  } catch (err) {
    console.error("[Web Push] erro ao notificar equipe:", err);
  }
}

/**
 * Push para quem tem um dos papéis informados (ex.: supervisor e gestor quando
 * um responsável escolhe o horário da 1ª avaliação). Nunca lança. O texto não
 * deve levar nome nem dado de saúde: aparece na tela bloqueada.
 */
export async function notifyRolesPush(params: { roles: string[]; title: string; body: string; url: string }): Promise<{ sent: number }> {
  try {
    if (!configure()) return { sent: 0 };
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const { data: people } = await supabase.from("profiles").select("id").in("role", params.roles).eq("active", true);
    const userIds = new Set((people ?? []).map((p) => p.id));
    if (userIds.size === 0) return { sent: 0 };

    const { data: subs } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
    const targets = (subs ?? []).filter((s) => userIds.has(s.user_id));
    if (targets.length === 0) return { sent: 0 };

    const payload = JSON.stringify({ title: params.title, body: params.body, url: params.url });
    const now = new Date().toISOString();
    let sent = 0;
    await Promise.all(
      targets.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 12,
            urgency: "normal",
          });
          sent += 1;
          await supabase.from("push_subscriptions").update({ last_success_at: now }).eq("id", s.id);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("[Web Push] falha ao enviar:", status ?? err);
          }
        }
      }),
    );
    return { sent };
  } catch (err) {
    console.error("[Web Push] erro ao notificar papéis:", err);
    return { sent: 0 };
  }
}
