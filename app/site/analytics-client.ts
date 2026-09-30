"use client";

/**
 * Disparo de eventos de conversão da landing (app/site) para as ferramentas
 * carregadas em analytics.tsx (GA4, Meta Pixel, GTM/dataLayer).
 *
 * Cada função checa se a ferramenta existe em `window` antes de chamar —
 * nenhuma delas é obrigatória: se o e-mail de marketing ainda não configurou
 * NEXT_PUBLIC_META_PIXEL_ID, por exemplo, `window.fbq` nunca existe e a
 * chamada vira um no-op silencioso, sem quebrar o formulário.
 *
 * Só rastreamos ação de verdade (envio de formulário bem-sucedido, clique
 * em WhatsApp) — nunca o carregamento da seção de CTA ou o foco num campo,
 * que infla "conversão" sem o visitante ter pedido nada.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Origem de onde o lead veio dentro da própria página (ex.: "cta-final"). */
export function trackLeadSubmitted(origem: string) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "generate_lead", { method: origem });
  window.fbq?.("track", "Lead", { content_name: origem });
  window.dataLayer?.push({ event: "generate_lead", lead_origin: origem });
}

/** Clique num canal de contato direto (WhatsApp) — não é lead ainda, mas é
 *  o sinal mais próximo de intenção que temos fora do formulário. */
export function trackContactClick(canal: "whatsapp", local: string) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "contact", { method: canal, location: local });
  window.fbq?.("trackCustom", "ContactClick", { channel: canal, location: local });
  window.dataLayer?.push({ event: "contact_click", channel: canal, location: local });
}

/**
 * Evento genérico de comportamento (SXO). Usa gtag quando o GA4 direto está
 * carregado (o próprio gtag já empurra para o dataLayer) e cai no dataLayer
 * puro quando só há GTM, para nunca contar o mesmo evento duas vezes.
 */
export function trackEvent(nome: string, params: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  if (window.gtag) window.gtag("event", nome, params);
  else window.dataLayer?.push({ event: nome, ...params });
}

export type ClasseOrigem = "ia" | "busca" | "social" | "email" | "direto" | "outro";

const FONTES_IA = ["chatgpt", "openai", "perplexity", "gemini", "copilot", "claude", "you.com", "poe.com", "meta.ai", "deepseek"];
const FONTES_BUSCA = ["google", "bing", "duckduckgo", "yahoo", "ecosia", "brave"];
const FONTES_SOCIAL = ["instagram", "facebook", "whatsapp", "wa.me", "t.co", "youtube", "tiktok"];

/**
 * Classifica de onde o visitante veio: separa tráfego de assistentes de IA
 * (métrica de GEO/AEO, que o GA4 padrão joga em "Referral") de busca
 * tradicional (SEO). utm_source tem prioridade sobre o referrer.
 */
export function classificarOrigem(referrer: string, utmSource: string | null): ClasseOrigem {
  const fonte = (utmSource ?? "").toLowerCase();
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  const alvo = fonte || host;
  if (!alvo) return "direto";
  if (fonte === "email" || fonte === "brevo") return "email";
  if (FONTES_IA.some((h) => alvo.includes(h))) return "ia";
  if (FONTES_BUSCA.some((h) => alvo.includes(h))) return "busca";
  if (FONTES_SOCIAL.some((h) => alvo.includes(h))) return "social";
  return "outro";
}
