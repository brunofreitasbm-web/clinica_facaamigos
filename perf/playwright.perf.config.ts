import { defineConfig } from "@playwright/test";
import path from "node:path";

// Benchmark separado de qualquer e2e futuro — roda contra `next start`
// (produção), nunca `next dev`, porque dev tem overhead de compilação sob
// demanda que envenenaria qualquer comparação de tempo.
export default defineConfig({
  testDir: __dirname,
  testMatch: ["auth.setup.ts", "nav.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "bench",
      testMatch: /nav\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: path.join(__dirname, ".auth", "gestor.json") },
    },
  ],
});
