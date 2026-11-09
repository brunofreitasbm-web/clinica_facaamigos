// lib/whatsapp-window-pure.ts
// Regras PURAS da janela de serviço de 24h do WhatsApp (conta desde a última mensagem
// RECEBIDA do contato). Sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/whatsapp-window-pure.test.ts) e
// para ser usada igual na tela do desktop, no celular e no servidor.

/** Janela real da Meta: dentro dela texto livre é entregue; fora, só template aprovado. */
export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Margem do disparo AUTOMÁTICO (lib/whatsapp-window.ts): o bot e os crons param 1h antes
 * do fim para não mandar texto que a Meta vai recusar. A recepção usa a janela real.
 */
export const WHATSAPP_AUTOMATION_WINDOW_MS = 23 * 60 * 60 * 1000;

/** Quanto falta para a janela fechar; `0` se já fechou ou se o contato nunca escreveu. */
export function windowRemainingMs(
  lastInboundAt: string | null | undefined,
  nowMs: number,
  windowMs: number = WHATSAPP_SERVICE_WINDOW_MS,
): number {
  if (!lastInboundAt) return 0;
  const last = Date.parse(lastInboundAt);
  if (!Number.isFinite(last)) return 0;
  return Math.max(0, windowMs - (nowMs - last));
}

/** true quando a janela já fechou ou nunca esteve aberta (sem mensagem recebida registrada). */
export function isWindowClosed(
  lastInboundAt: string | null | undefined,
  nowMs: number,
  windowMs: number = WHATSAPP_SERVICE_WINDOW_MS,
): boolean {
  return windowRemainingMs(lastInboundAt, nowMs, windowMs) <= 0;
}

/** Aviso só nas últimas 2h, para não virar ruído o resto do tempo. */
export const WINDOW_CLOSING_SOON_MS = 2 * 60 * 60 * 1000;

/** "1h20" / "45 min" quando a janela está para fechar; `null` fora das últimas 2h ou se já fechou. */
export function windowClosingLabel(lastInboundAt: string | null | undefined, nowMs: number): string | null {
  const left = windowRemainingMs(lastInboundAt, nowMs);
  if (left <= 0 || left > WINDOW_CLOSING_SOON_MS) return null;
  const totalMin = Math.ceil(left / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
