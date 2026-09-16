import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ROUTES } from "./routes";

const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 5);
const TAG = process.env.PERF_RUN_TAG ?? "run";
const RESULTS_DIR = path.join(__dirname, "results");

type NavTiming = {
  route: string;
  label: string;
  iteration: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  transferSizeBytes: number;
};

const rows: NavTiming[] = [];

for (const route of ROUTES) {
  test(`cold nav: ${route.label}`, async ({ page }) => {
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = Date.now();
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.locator(route.ready).first().waitFor({ state: "visible", timeout: 30_000 });
      const t1 = Date.now();

      const nav = await page.evaluate(() => {
        const e = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (!e) return null;
        return {
          ttfb: e.responseStart - e.startTime,
          dcl: e.domContentLoadedEventEnd - e.startTime,
          load: e.loadEventEnd - e.startTime,
          transferSize: e.transferSize,
        };
      });

      rows.push({
        route: route.path,
        label: route.label,
        iteration: i,
        ttfbMs: nav?.ttfb ?? -1,
        domContentLoadedMs: nav?.dcl ?? t1 - t0,
        // loadEventEnd pode não disparar em navegações client-heavy antes do
        // teardown do teste; usa o wall-clock até o seletor "pronto" visível
        // como piso caso a Navigation Timing API não tenha resolvido a
        // tempo — mais honesto que reportar 0.
        loadEventMs: nav && nav.load > 0 ? nav.load : t1 - t0,
        transferSizeBytes: nav?.transferSize ?? 0,
      });
    }
  });
}

type ClickTiming = {
  from: string;
  to: string;
  iteration: number;
  clickToVisibleMs: number;
};

const clickRows: ClickTiming[] = [];

// A métrica que o pedido original mira: tempo de clique-no-menu até o
// conteúdo da tela seguinte aparecer, client-side, sem full reload —
// exatamente a "demora entre telas" que staleTimes/Suspense/loading.tsx
// atacam. /gestor -> Inteligência BI é o par mais pesado do módulo.
test("menu click: Gestor -> Inteligência BI", async ({ page }) => {
  for (let i = 0; i < ITERATIONS; i++) {
    await page.goto("/gestor", { waitUntil: "domcontentloaded" });
    await page.locator("text=Vazamento 1").first().waitFor({ state: "visible", timeout: 30_000 });

    const t0 = Date.now();
    await page.getByRole("link", { name: "Inteligência BI" }).click();
    await page.locator("text=Pacientes por Plano de Saúde").first().waitFor({ state: "visible", timeout: 30_000 });
    const t1 = Date.now();

    clickRows.push({ from: "/gestor", to: "/gestor/inteligencia", iteration: i, clickToVisibleMs: t1 - t0 });
  }
});

test.afterAll(async () => {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `${TAG}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        tag: TAG,
        timestamp: new Date().toISOString(),
        iterations: ITERATIONS,
        rows,
        clickRows,
      },
      null,
      2,
    ),
  );
  console.log(`[perf] wrote ${rows.length} rows to ${outFile}`);
});
