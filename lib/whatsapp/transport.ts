// lib/whatsapp/transport.ts
/**
 * Camada de envio de mensagens — duas implementações atrás da mesma
 * interface: `twilio` (REST real) e `simulator` (só grava em
 * `whatsapp_messages`, sem chamada externa). Escolhida por
 * WHATSAPP_TRANSPORT (default `simulator`, decisão do dono da clínica
 * enquanto a conta Twilio ainda é trial sem WhatsApp Sender aprovado — ver
 * app/gestor/integracoes/whatsapp/simulador).
 *
 * Toda mensagem enviada (por qualquer transporte) grava uma linha outbound
 * em `whatsapp_messages`, pra o transcript do simulador e o painel do
 * gestor mostrarem a conversa real, não um mock.
 */
import twilioLib from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioEnv, getWhatsappTransportMode } from "./env";

export type ListPickerItem = { id: string; title: string };

export type MessageTransport = {
  sendText(to: string, body: string): Promise<void>;
  sendListPicker(
    to: string,
    params: { body: string; button: string; items: ListPickerItem[] },
  ): Promise<void>;
  sendTemplate(to: string, contentSid: string, variables: Record<string, string>): Promise<void>;
  downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string }>;
};

async function recordOutbound(params: {
  conversationId: string;
  body: string;
  contentSid?: string;
  providerSid?: string;
}) {
  const admin = createAdminClient();
  await admin.from("whatsapp_messages").insert({
    conversation_id: params.conversationId,
    direction: "outbound",
    body: params.body,
    content_sid: params.contentSid ?? null,
    provider_sid: params.providerSid ?? null,
  });
}

/**
 * Formata a lista como texto numerado — usado tanto pelo simulador (não há
 * list-picker de fato fora do WhatsApp) quanto como corpo legível caso o
 * envio do Content Template falhe.
 */
function listAsText(body: string, items: ListPickerItem[]): string {
  const options = items.map((item, i) => `${i + 1}️⃣ ${item.title}`).join("\n");
  return `${body}\n\n${options}`;
}

function makeSimulatorTransport(conversationId: string): MessageTransport {
  return {
    async sendText(_to, body) {
      await recordOutbound({ conversationId, body });
    },
    async sendListPicker(_to, { body, items }) {
      await recordOutbound({ conversationId, body: listAsText(body, items) });
    },
    async sendTemplate(_to, contentSid, variables) {
      const body = `[template ${contentSid}] ${JSON.stringify(variables)}`;
      await recordOutbound({ conversationId, body, contentSid });
    },
    async downloadMedia(url) {
      // No simulador a "mídia" é um asset já hospedado (ex.: URL assinada do
      // próprio bucket clinic-documents, ver simulador-actions.ts) — só
      // repassamos o fetch, sem autenticação Twilio.
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao baixar mídia simulada: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
      };
    },
  };
}

function makeTwilioTransport(conversationId: string): MessageTransport {
  const env = getTwilioEnv();
  const client = twilioLib(env.apiKey, env.apiSecret, { accountSid: env.accountSid });

  return {
    async sendText(to, body) {
      const message = await client.messages.create({ from: env.whatsappFrom, to, body });
      await recordOutbound({ conversationId, body, providerSid: message.sid });
    },
    async sendListPicker(to, { body, button, items }) {
      // Content Templates aceitam envio in-session sem aprovação do Meta
      // (ver docs.twilio.com/content/session-definitions) — criamos o
      // Content on-the-fly a cada oferta porque os itens (horários) mudam
      // a cada conversa; limite de 10 itens/título ≤24 chars é respeitado
      // por quem monta `items` (lib/whatsapp/slots.ts).
      const content = await client.content.v1.contents.create({
        friendlyName: `list-picker-${Date.now()}`,
        language: "pt_BR",
        types: {
          twilioListPicker: {
            body,
            button,
            items: items.map((item) => ({ id: item.id, item: item.title })),
          },
        },
      });
      const message = await client.messages.create({
        from: env.whatsappFrom,
        to,
        contentSid: content.sid,
      });
      await recordOutbound({
        conversationId,
        body: listAsText(body, items),
        contentSid: content.sid,
        providerSid: message.sid,
      });
    },
    async sendTemplate(to, contentSid, variables) {
      const message = await client.messages.create({
        from: env.whatsappFrom,
        to,
        contentSid,
        contentVariables: JSON.stringify(variables),
      });
      await recordOutbound({
        conversationId,
        body: `[template] ${JSON.stringify(variables)}`,
        contentSid,
        providerSid: message.sid,
      });
    },
    async downloadMedia(url) {
      const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
      const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      if (!res.ok) throw new Error(`Falha ao baixar mídia do Twilio: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
      };
    },
  };
}

export function getTransport(conversationId: string): MessageTransport {
  return getWhatsappTransportMode() === "twilio"
    ? makeTwilioTransport(conversationId)
    : makeSimulatorTransport(conversationId);
}
