// Uso: node perf/compare.mjs baseline after
// Lê perf/results/<tag>.json de cada lado e produz uma tabela markdown de
// mediana por rota + o clique de menu, em perf/results/COMPARISON.md.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, "results");

const [beforeTag, afterTag] = process.argv.slice(2);
if (!beforeTag || !afterTag) {
  console.error("Uso: node perf/compare.mjs <tag-antes> <tag-depois>");
  process.exit(1);
}

function load(tag) {
  return JSON.parse(readFileSync(path.join(RESULTS_DIR, `${tag}.json`), "utf8"));
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmtMs(n) {
  return `${Math.round(n)} ms`;
}

function fmtDelta(before, after) {
  const delta = after - before;
  const pct = before !== 0 ? (delta / before) * 100 : 0;
  const sign = delta <= 0 ? "" : "+";
  const arrow = delta < 0 ? "↓" : delta > 0 ? "↑" : "→";
  return `${sign}${Math.round(delta)} ms (${sign}${pct.toFixed(0)}%) ${arrow}`;
}

const before = load(beforeTag);
const after = load(afterTag);

const routesBefore = groupByRoute(before.rows);
const routesAfter = groupByRoute(after.rows);

function groupByRoute(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.route)) map.set(r.route, { label: r.label, ttfb: [], dcl: [], load: [] });
    const g = map.get(r.route);
    g.ttfb.push(r.ttfbMs);
    g.dcl.push(r.domContentLoadedMs);
    g.load.push(r.loadEventMs);
  }
  return map;
}

let md = `# Comparativo de performance — antes vs. depois\n\n`;
md += `Gerado em ${new Date().toISOString()}\n\n`;
md += `- **Antes** (\`${beforeTag}\`): ${before.timestamp}, ${before.iterations} iterações/rota\n`;
md += `- **Depois** (\`${afterTag}\`): ${after.timestamp}, ${after.iterations} iterações/rota\n\n`;
md += `Todas as medições contra \`next build && next start\` (produção), nunca \`next dev\`. Mediana de todas as iterações (1ª iteração inclusa — sem warm-up separado nesta rodada).\n\n`;

md += `## Navegação por rota (cold nav)\n\n`;
md += `| Rota | TTFB antes | TTFB depois | DOMContentLoaded antes | DOMContentLoaded depois | Δ DCL |\n`;
md += `|---|---|---|---|---|---|\n`;

for (const [route, g] of routesBefore) {
  const a = routesAfter.get(route);
  if (!a) continue;
  const ttfbB = median(g.ttfb);
  const ttfbA = median(a.ttfb);
  const dclB = median(g.dcl);
  const dclA = median(a.dcl);
  md += `| ${g.label} (\`${route}\`) | ${fmtMs(ttfbB)} | ${fmtMs(ttfbA)} | ${fmtMs(dclB)} | ${fmtMs(dclA)} | ${fmtDelta(dclB, dclA)} |\n`;
}

md += `\n## Transição de menu (clique, sem reload completo)\n\n`;
md += `| De → Para | Antes (mediana) | Depois (mediana) | Δ |\n`;
md += `|---|---|---|---|\n`;

if (before.clickRows?.length && after.clickRows?.length) {
  const cb = median(before.clickRows.map((r) => r.clickToVisibleMs));
  const ca = median(after.clickRows.map((r) => r.clickToVisibleMs));
  const from = before.clickRows[0].from;
  const to = before.clickRows[0].to;
  md += `| ${from} → ${to} | ${fmtMs(cb)} | ${fmtMs(ca)} | ${fmtDelta(cb, ca)} |\n`;
}

md += `\n## Dados brutos\n\nVer \`perf/results/${beforeTag}.json\` e \`perf/results/${afterTag}.json\`.\n`;

const outPath = path.join(RESULTS_DIR, "COMPARISON.md");
writeFileSync(outPath, md);
console.log(md);
console.log(`\n[perf] escrito em ${outPath}`);
