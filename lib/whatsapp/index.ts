import {
  WHATSAPP_WINDOW_CLOSED_ERROR_CODES as TWILIO_WINDOW_CLOSED_ERROR_CODES,
  getTwilioContentSidForCategory,
  isTwilioConfigured,
  sendTwilioWhatsApp,
  type SendMessageOptions,
  type SendMessageResult,
} from "@/lib/twilio";
import { resolveWhatsAppProviderId, type WhatsAppProviderId } from "@/lib/whatsapp/provider-pure";

/**
 * Porta única de envio de WhatsApp. Os chamadores (bots, recepção, crons)
 * falam com este módulo e não sabem qual provedor está por trás — a troca
 * Twilio → Cloud API da Meta acontece aqui, controlada por `WHATSAPP_PROVIDER`
 * (padrão "twilio"). SMS, OTP (Verify) e Voz continuam em `lib/twilio.ts`.
 *
 * Etapa atual: só o provedor "twilio" existe. "meta" responde com erro claro
 * até a implementação (docs/migracao-whatsapp-cloud-api.md, Passo 2).
 */

export type { SendMessageOptions, SendMessageResult, WhatsAppProviderId };

/**
 * `contentSid`/`contentVariables` ainda têm formato Twilio (Content API). Na
 * Cloud API o template vira nome + idioma + componentes; essa tradução entra
 * com o provedor "meta".
 */
export interface WhatsAppProvider {
  id: WhatsAppProviderId;
  isConfigured(): boolean;
  send(options: SendMessageOptions): Promise<SendMessageResult>;
  /** Códigos de erro que significam "fora da janela de 24h; só template reabre". */
  windowClosedErrorCodes: readonly number[];
  /** Identificador de template configurado para a categoria do fluxo. */
  templateIdForCategory(category: string): string | undefined;
}

const twilioProvider: WhatsAppProvider = {
  id: "twilio",
  isConfigured: isTwilioConfigured,
  send: sendTwilioWhatsApp,
  windowClosedErrorCodes: TWILIO_WINDOW_CLOSED_ERROR_CODES,
  templateIdForCategory: getTwilioContentSidForCategory,
};

const NOT_AVAILABLE_ERROR = "Provedor de WhatsApp indisponível: confira WHATSAPP_PROVIDER (twilio | meta).";

const unavailableProvider = (id: WhatsAppProviderId | "invalid", reason: string): WhatsAppProvider => ({
  id: id === "invalid" ? "twilio" : id,
  isConfigured: () => false,
  send: async () => ({ success: false, channel: "whatsapp", error: reason }),
  windowClosedErrorCodes: [],
  templateIdForCategory: () => undefined,
});

export function getWhatsAppProvider(): WhatsAppProvider {
  const id = resolveWhatsAppProviderId(process.env.WHATSAPP_PROVIDER);
  if (id === "twilio") return twilioProvider;
  if (id === "meta") {
    return unavailableProvider("meta", "Provedor Meta (Cloud API) ainda não implementado neste ambiente.");
  }
  return unavailableProvider("invalid", NOT_AVAILABLE_ERROR);
}

export function sendWhatsApp(options: SendMessageOptions): Promise<SendMessageResult> {
  return getWhatsAppProvider().send(options);
}

export function isWhatsAppConfigured(): boolean {
  return getWhatsAppProvider().isConfigured();
}

export function getWhatsAppTemplateForCategory(category: string): string | undefined {
  return getWhatsAppProvider().templateIdForCategory(category);
}

export function isWhatsAppWindowClosedError(errorCode: number | undefined): boolean {
  return errorCode !== undefined && getWhatsAppProvider().windowClosedErrorCodes.includes(errorCode);
}
