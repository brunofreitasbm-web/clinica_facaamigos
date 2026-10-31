import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";

/** Margem sobre as 24h da janela de serviço do WhatsApp (conta desde a última mensagem do contato). */
const WINDOW_MS = 23 * 60 * 60 * 1000;

/**
 * A janela de 24h do WhatsApp está aberta para este telefone? Só nela o texto
 * livre é entregue; fora dela só template aprovado. Usado para não disparar
 * texto que a Meta vai recusar (a falha só aparece depois, no status callback).
 * Na dúvida (sem conversa, erro de leitura) devolve false.
 */
export async function isWhatsAppWindowOpen(phone: string, nowMs: number = Date.now()): Promise<boolean> {
  try {
    const e164 = formatE164Phone(phone.replace("whatsapp:", ""));
    if (!e164) return false;
    const { data } = await createAdminClient()
      .from("twilio_conversations")
      .select("last_inbound_at")
      .eq("phone_number", e164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.last_inbound_at ? Date.parse(data.last_inbound_at) : 0;
    return last > 0 && nowMs - last < WINDOW_MS;
  } catch {
    return false;
  }
}
