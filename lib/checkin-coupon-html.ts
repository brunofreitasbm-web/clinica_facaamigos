// lib/checkin-coupon-html.ts
//
// Markup do cupom como STRING (não JSX): o mesmo HTML precisa ir tanto para
// `iframe.srcdoc` (impressão real, lib/print-coupon.ts) quanto para a prévia
// da tela de configurações (`dangerouslySetInnerHTML`). Renderizar React num
// `contentDocument` de iframe externo exigiria `createPortal` com timing
// frágil sob React 19 + Strict Mode — uma string elimina esse problema e
// garante que prévia e impressão real nunca divergem.
//
// `renderCouponBody` é só o conteúdo (usado na prévia, dentro de um
// container que já tem a largura/fonte certas). `renderCouponDocument`
// envolve isso num documento HTML completo com `@page` e o CSS — é o que
// vai para `srcdoc`.

import type { CouponModel } from "./checkin-coupon";

/** Escapa para uso em texto HTML — cabeçalho/rodapé são texto livre do gestor, nunca HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto livre (cabeçalho/rodapé): escapa e converte quebras de linha em `<br>`. */
function freeText(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function renderLine(label: string | null, value: string | null): string {
  if (!value) return "";
  return `<div class="row"><span class="b">${escapeHtml(label ?? "")}</span> ${escapeHtml(value)}</div>`;
}

export function renderCouponBody(model: CouponModel): string {
  const parts: string[] = [];

  if (model.logoUrl) {
    parts.push(`<img class="logo" src="${escapeHtml(model.logoUrl)}" alt="">`);
  }
  if (model.clinicName) {
    parts.push(`<div class="big" style="text-align:center">${escapeHtml(model.clinicName)}</div>`);
  }
  if (model.headerText) {
    parts.push(`<div style="text-align:center">${freeText(model.headerText)}</div>`);
  }

  parts.push(`<div class="sep"></div>`);

  if (model.patientName) parts.push(renderLine("Paciente:", model.patientName));
  parts.push(renderLine("Data:", model.dateLabel));
  if (model.checkinTimeLabel) parts.push(renderLine("Check-in:", model.checkinTimeLabel));
  if (model.ticketLabel) parts.push(renderLine("Senha:", model.ticketLabel));

  parts.push(`<div class="sep"></div>`);
  parts.push(`<div class="b" style="margin-bottom:1mm">Roteiro do dia</div>`);

  if (model.lines.length === 0) {
    parts.push(`<div class="row">Nenhuma sessão encontrada para hoje.</div>`);
  }
  for (const line of model.lines) {
    const bits = [line.timeRange, line.roomName, line.disciplineLabel, line.therapistName].filter(
      (b): b is string => Boolean(b),
    );
    parts.push(`<div class="row">${bits.map(escapeHtml).join(" · ")}</div>`);
  }

  if (model.warnings.length > 0) {
    parts.push(`<div class="sep"></div>`);
    for (const warning of model.warnings) {
      parts.push(`<div class="row warn">⚠ ${escapeHtml(warning)}</div>`);
    }
  }

  if (model.footerText || model.printedAtLabel) {
    parts.push(`<div class="sep"></div>`);
    if (model.footerText) {
      parts.push(`<div style="text-align:center">${freeText(model.footerText)}</div>`);
    }
    if (model.printedAtLabel) {
      parts.push(
        `<div style="text-align:center;margin-top:1mm" class="small">Impresso em ${escapeHtml(model.printedAtLabel)}</div>`,
      );
    }
  }

  return parts.join("\n");
}

/**
 * CSS do documento completo. `W` = largura do papel em mm. Tamanhos de
 * fonte/logo escalam com a largura pra o cupom de 58mm não sair
 * proporcionalmente maior que o de 80mm.
 */
function couponCss(paperWidthMm: number): string {
  const w = paperWidthMm;
  const fontSize = w === 80 ? 12 : 11;
  const bigSize = w === 80 ? 16 : 14;
  const logoMaxWidth = w === 80 ? 40 : 30;
  const sidePadding = w === 80 ? 4 : 3;

  return `
    @page { size: ${w}mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      width: ${w}mm;
      padding: 3mm ${sidePadding}mm 8mm;
      font-family: "Courier New", ui-monospace, monospace;
      font-size: ${fontSize}px;
      line-height: 1.35;
      color: #000;
      -webkit-text-size-adjust: none;
    }
    * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
    .sep { border-top: 1px dashed #000; margin: 2mm 0; }
    .row { page-break-inside: avoid; margin-bottom: 1.2mm; }
    .b { font-weight: 700; }
    .big { font-size: ${bigSize}px; font-weight: 700; }
    .small { font-size: ${Math.max(fontSize - 2, 9)}px; }
    .warn { font-weight: 700; }
    .logo { display: block; margin: 0 auto 2mm; max-width: ${logoMaxWidth}mm; max-height: 18mm; filter: grayscale(1) contrast(1.6); }
  `;
}

/** Documento HTML completo (`<html>` com `<style>` e `@page`) — usado por `iframe.srcdoc`. */
export function renderCouponDocument(model: CouponModel): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>${couponCss(model.paperWidthMm)}</style>
</head>
<body>
${renderCouponBody(model)}
</body>
</html>`;
}
