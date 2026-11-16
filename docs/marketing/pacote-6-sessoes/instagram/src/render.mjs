// Uso: node src/render.mjs   (a partir da pasta instagram/)
// Le src/config.json, valida o texto contra as palavras proibidas, gera HTML em src/_build e PNGs em out/.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarPecas } from './pecas.mjs';
import { gerarLegendas } from './legendas.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');
const out = path.join(raiz, 'out');
const build = path.join(aqui, '_build');
const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
  try { playwright = require(p); break; } catch {}
}
if (!playwright) { console.error('playwright nao encontrado (npm i playwright && npx playwright install chromium)'); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(path.join(aqui, 'config.json'), 'utf8'));

// ---------- trava de conformidade: recusa o render se o texto tiver termo proibido ----------
import { PROIBIDAS } from './render-lint.mjs';
function strings(o, acc = []) {
  if (typeof o === 'string') acc.push(o);
  else if (Array.isArray(o)) o.forEach((x) => strings(x, acc));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (k !== '_leia') strings(v, acc);
  return acc;
}
const textos = strings(cfg).map((s) => s.replaceAll('{plano}', 'plano ' + cfg.plano.nome).replaceAll('{nome}', cfg.plano.nome));
const falhas = [];
for (const s of textos) for (const re of PROIBIDAS) if (re.test(s)) falhas.push(`${re} em: "${s}"`);
if (falhas.length) { console.error('RENDER RECUSADO. Termos proibidos:\n' + falhas.join('\n')); process.exit(2); }
console.log('Lint de conformidade: ok (' + textos.length + ' textos)');

// ---------- gera HTML ----------
fs.rmSync(build, { recursive: true, force: true });
fs.mkdirSync(build, { recursive: true });
fs.mkdirSync(out, { recursive: true });
const pecas = criarPecas(cfg);
const css = path.join(aqui, 'styles.css');
fs.cpSync(css, path.join(build, 'styles.css'));
fs.cpSync(path.join(aqui, 'assets'), path.join(build, 'assets'), { recursive: true });
for (const p of pecas) {
  fs.writeFileSync(path.join(build, p.id + '.html'),
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body style="margin:0"><div class="${p.cls}" style="width:${p.w}px;height:${p.h}px">${p.html}</div></body></html>`);
}

// ---------- render ----------
const browser = await playwright.chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const lista = [];
for (const p of pecas) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: p.w, height: p.h });
  await page.goto(pathToFileURL(path.join(build, p.id + '.html')).href);
  await page.evaluate(async () => {
    await document.fonts.load('600 40px Fredoka'); await document.fonts.load('700 40px Fredoka');
    await document.fonts.load('600 40px Nunito'); await document.fonts.load('800 40px Nunito'); await document.fonts.load('900 40px Nunito');
    await document.fonts.ready;
  });
  const ok = await page.evaluate(() => document.fonts.check('600 40px Fredoka') && document.fonts.check('800 40px Nunito'));
  if (!ok) { console.error('FONTE NAO CARREGOU em ' + p.id); process.exit(3); }
  // verifica estouro de texto
  const estouro = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('h1,h2,h3,p,span,.chip,.btn,.step').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).display !== 'inline') bad.push(el.className || el.tagName);
    });
    return bad;
  });
  if (estouro.length) console.warn('AVISO estouro horizontal em ' + p.id + ': ' + estouro.join(','));
  await page.screenshot({ path: path.join(out, p.id + '.png'), clip: { x: 0, y: 0, width: p.w, height: p.h } });
  await page.close();
  lista.push({ id: p.id, w: p.w, h: p.h, alt: p.alt });
}
fs.writeFileSync(path.join(out, 'alt-texts.json'), JSON.stringify(lista, null, 2));

// ---------- contact sheet ----------
const thumbs = lista.map((p) => {
  const tw = 270, th = Math.round((p.h / p.w) * tw);
  return `<figure style="margin:0"><img src="${pathToFileURL(path.join(out, p.id + '.png')).href}" width="${tw}" height="${th}" style="display:block;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2)"><figcaption style="font:600 13px Nunito,sans-serif;color:#065264;margin-top:6px">${p.id}</figcaption></figure>`;
}).join('');
const sheet = `<!doctype html><body style="margin:0;background:#fff"><div style="width:1620px;padding:30px;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">${thumbs}</div></body>`;
fs.writeFileSync(path.join(build, 'contact.html'), sheet);
const pg = await ctx.newPage();
await pg.setViewportSize({ width: 1680, height: 900 });
await pg.goto(pathToFileURL(path.join(build, 'contact.html')).href);
await pg.waitForLoadState('load');
await pg.screenshot({ path: path.join(out, '..', 'contact-sheet.png'), fullPage: true });
await browser.close();
gerarLegendas(cfg, raiz, lista);
console.log(lista.length + ' PNGs em ' + out);
