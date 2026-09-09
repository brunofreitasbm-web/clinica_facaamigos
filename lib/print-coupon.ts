"use client";

import type { CouponModel } from "./checkin-coupon";
import { renderCouponDocument } from "./checkin-coupon-html";

// lib/print-coupon.ts
//
// Impressão do cupom de check-in via iframe oculto + `window.print()` — sem
// agente ESC/POS, sem PDF (decisão do usuário). Ver docs/impressao-cupom.md
// para como eliminar o diálogo de impressão do navegador (kiosk-printing).
//
// Por que iframe e não `@media print` na própria página: a agenda tem DOM
// grande e todo o app/globals.css (tokens Tailwind, .card, .table); imprimir
// a página exigiria o hack de `visibility:hidden` de components/payout-statement.tsx,
// e o `@page { size: 80mm }` do cupom contaminaria a impressão normal da
// página. O iframe dá um documento limpo, isolado, que serve o mesmo HTML
// tanto pra impressão real quanto pra prévia da tela de configurações.

/**
 * `model.logoUrl` vem relativo do server (`/brand/...`) — dentro de
 * `iframe.srcdoc` a base do documento é `about:srcdoc` e caminho relativo
 * não resolve. Chame isto antes de `renderCouponDocument` sempre que o HTML
 * for para impressão real (não é necessário na prévia em página, que
 * resolve o caminho relativo normalmente contra a própria origem).
 */
export function resolveCouponModelForPrint(model: CouponModel): CouponModel {
  if (!model.logoUrl || /^https?:\/\//.test(model.logoUrl)) return model;
  return { ...model, logoUrl: new URL(model.logoUrl, window.location.origin).href };
}

/**
 * Atalho: resolve a logo pra URL absoluta, renderiza o documento e imprime.
 * É o que a recepção (today-agenda-list.tsx, chegadas-list.tsx) e a tela de
 * configurações ("Imprimir teste") chamam — sempre o mesmo caminho, pra
 * nunca esquecer o `resolveCouponModelForPrint` num dos pontos de impressão.
 */
export function printCoupon(model: CouponModel): void {
  printCouponHtml(renderCouponDocument(resolveCouponModelForPrint(model)));
}

/**
 * Imprime um documento HTML completo (de `renderCouponDocument`) num iframe
 * oculto. Fire-and-forget — não devolve uma Promise porque o chamador não
 * precisa (nem pode, de forma confiável) esperar o fim da impressão.
 */
export function printCouponHtml(html: string): void {
  const iframe = document.createElement("iframe");
  // NUNCA display:none/visibility:hidden — um iframe sem layout não
  // imprime (contentWindow.print() sai em branco em Chrome/Firefox).
  iframe.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; opacity:0;";
  iframe.setAttribute("aria-hidden", "true");

  let done = false;
  function cleanup() {
    if (done) return;
    done = true;
    iframe.remove();
  }

  iframe.onload = async () => {
    try {
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        cleanup();
        return;
      }

      const imageLoads = Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      );
      const fontsReady = doc.fonts?.ready ?? Promise.resolve();

      // Logo lenta ou 404 nunca pode travar o balcão — 2s de tolerância e segue.
      await Promise.race([
        Promise.all([...imageLoads, fontsReady]),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      // Duplo rAF: garante que o layout do documento recém-carregado assentou
      // antes de chamar print() (evita cupom em branco em alguns navegadores).
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      win.focus();
      win.print();
    } finally {
      // `afterprint` não dispara de forma confiável sob --kiosk-printing em
      // todos os navegadores/versões — o timeout é a rede de segurança que
      // garante que o iframe não vaza pro resto do dia.
      scheduleCleanup(iframe.contentWindow, cleanup);
    }
  };

  document.body.appendChild(iframe);
  iframe.setAttribute("srcdoc", html);
}

function scheduleCleanup(win: Window | null | undefined, cleanup: () => void) {
  if (win) {
    win.addEventListener("afterprint", cleanup, { once: true });
  }
  setTimeout(cleanup, 60_000);
}
