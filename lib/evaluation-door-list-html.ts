import type { DoorListRow } from "@/lib/evaluation-door-list-pure";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Página A4 da lista do dia (acrílico da porta da sala de avaliação), em HTML
 * autônomo — sem layout do app, sem webfont — para ser impressa pelo navegador
 * da recepção. Só contornos pretos finos (impressora P&B, economia de toner).
 *
 * `auto`: a página roda dentro de um iframe escondido (components/door-list-
 * auto-print.tsx) e avisa o pai (`ready` quando há avaliações, `empty` quando
 * não há) para ele disparar a impressão. Sem `auto`, é a prévia manual, com
 * botão Imprimir.
 */
export function renderDoorListHtml(opts: { dateLabel: string; rows: DoorListRow[]; auto: boolean }): string {
  const { dateLabel, rows, auto } = opts;
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<div class="row"><span class="time">${escapeHtml(r.time)}</span><span class="pat">${escapeHtml(r.patient)}</span><span class="gua">${escapeHtml(r.guardian)}</span><span class="the">${escapeHtml(r.therapist)}</span></div>`,
        )
        .join("")
    : `<p class="empty">Nenhuma primeira avaliação agendada para hoje.</p>`;

  const state = rows.length ? "ready" : "empty";
  const autoScript = `<script>window.addEventListener("load",function(){var img=document.querySelector(".logo");var go=function(){parent.postMessage({type:"door-list",state:"${state}"},location.origin)};if(img&&!img.complete){img.addEventListener("load",go);img.addEventListener("error",go)}else{go()}})</script>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Primeira avaliação — ${escapeHtml(dateLabel)}</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0}
html,body{background:#fff;color:#000;font-family:"Arial Rounded MT Bold",Arial,Helvetica,sans-serif}
.page{width:210mm;min-height:297mm;padding:14mm 14mm 24mm;position:relative}
.logo{height:17mm;display:block}
h1{font-size:15mm;line-height:1;margin-top:9mm;font-weight:800}
.sub{font-size:3.4mm;letter-spacing:.2em;text-transform:uppercase;font-weight:700;margin-top:3mm}
.date{display:inline-block;margin-top:5mm;border:.5mm solid #000;border-radius:9mm;padding:2mm 6mm;font-size:5mm;font-weight:700}
.head,.row{display:grid;grid-template-columns:27mm 1.2fr 1.2fr 1.1fr;gap:3mm;align-items:center}
.head{margin-top:8mm;padding:0 6mm;font-size:3.1mm;letter-spacing:.14em;font-weight:700}
.row{border:.4mm solid #000;border-radius:9mm;padding:3.4mm 6mm;margin-top:2.6mm;break-inside:avoid}
.time{font-size:7.4mm;font-weight:800;border-right:.4mm solid #000}
.pat{font-size:5.4mm;font-weight:800}.gua{font-size:4.6mm}.the{font-size:4.3mm}
.empty{margin-top:12mm;font-size:5mm}
.foot{position:absolute;left:14mm;right:14mm;bottom:10mm;text-align:center;font-size:4.2mm;font-weight:700}
.foot small{display:block;font-size:2.8mm;font-weight:400;margin-top:1.5mm}
.btn{position:fixed;top:10px;right:10px;padding:8px 18px;border:2px solid #000;border-radius:999px;background:#fff;font:700 14px Arial;cursor:pointer}
@media print{.btn{display:none}}
</style></head><body>
<div class="page">
<img class="logo" src="/brand/facaamigos-horizontal-preto.png" alt="FaçaAmigos — Centro de Terapia Comportamental">
<h1>primeira avaliação</h1>
<div class="sub">Sala de avaliação · agenda de hoje</div>
<div class="date">${escapeHtml(dateLabel)}</div>
<div class="head"><span>HORA</span><span>PACIENTE</span><span>RESPONSÁVEL</span><span>TERAPEUTA</span></div>
${body}
<div class="foot">Seja bem-vindo(a)! Chegou? Avise a recepção que a gente cuida do resto.<small>Atualizado com a agenda do sistema</small></div>
</div>
${auto ? autoScript : `<button class="btn" onclick="window.print()">Imprimir</button>`}
</body></html>`;
}
