import { createClient } from "jsr:@supabase/supabase-js@2";

// Fallback do webhook de entrada do WhatsApp (Twilio). Configurar esta função
// como "Fallback URL" do número/Messaging Service: a Twilio só a chama quando o
// webhook principal (app/api/webhooks/twilio, na Vercel) não responde — app fora
// do ar, timeout, 5xx. Ela NÃO processa a mensagem: só valida a assinatura e a
// grava em twilio_inbound_queue; o cron /api/twilio/inbound-retry processa
// quando o app voltar. Assim a resposta do cliente não se perde.
//
// Deploy: supabase functions deploy twilio-inbound-fallback --no-verify-jwt
// (a Twilio não manda JWT; a autorização é a X-Twilio-Signature).
// Secrets: TWILIO_AUTH_TOKEN e TWILIO_FALLBACK_PUBLIC_URL (URL pública exata
// desta função, a mesma cadastrada na Twilio — entra no cálculo da assinatura).

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
const xml = (status = 200) => new Response(EMPTY_TWIML, { status, headers: { "Content-Type": "text/xml" } });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(url: string, params: Record<string, string>, signature: string, token: string): Promise<boolean> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  return timingSafeEqual(btoa(bin), signature);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const publicUrl = Deno.env.get("TWILIO_FALLBACK_PUBLIC_URL");
  if (!token || !publicUrl) {
    console.error("TWILIO_AUTH_TOKEN/TWILIO_FALLBACK_PUBLIC_URL não configurados");
    return new Response("não configurado", { status: 503 });
  }

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  if (!(await validSignature(publicUrl, params, req.headers.get("X-Twilio-Signature") ?? "", token))) {
    return new Response("assinatura inválida", { status: 403 });
  }

  const messageSid = params.MessageSid || params.SmsSid;
  if (!messageSid || !params.From) return new Response("sem MessageSid/From", { status: 400 });

  const numMedia = Number(params.NumMedia ?? "0") || 0;
  const media = Array.from({ length: numMedia }, (_, i) => ({
    url: params[`MediaUrl${i}`],
    contentType: params[`MediaContentType${i}`] || undefined,
  })).filter((m) => m.url);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Mesmo formato de InboundTwilioPayload (lib/twilio-inbound.ts).
  const { error } = await admin.from("twilio_inbound_queue").upsert(
    {
      message_sid: messageSid,
      source: "fallback",
      payload: {
        from: params.From,
        to: params.To ?? "",
        body: params.Body ?? "",
        messageSid,
        mediaUrl0: params.MediaUrl0 ?? "",
        mediaContentType0: params.MediaContentType0 ?? "",
        media,
      },
    },
    { onConflict: "message_sid", ignoreDuplicates: true },
  );
  if (error) {
    console.error("falha ao enfileirar:", error);
    return new Response("erro", { status: 500 });
  }
  return xml();
});
