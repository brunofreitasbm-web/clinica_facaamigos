import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, ".auth", "gestor.json");

setup("login as gestor", async ({ page }) => {
  const identifier = process.env.PERF_GESTOR_ID;
  const password = process.env.PERF_GESTOR_PW;
  if (!identifier || !password) {
    throw new Error("PERF_GESTOR_ID / PERF_GESTOR_PW não definidos (ver .env.perf.local)");
  }

  await page.goto("/login");
  await page.locator("#identifier").fill(identifier);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // signIn() redireciona pra "/", e o proxy então manda pra ROLE_HOME do
  // papel (gestor => "/gestor"). Espera sair de /login em vez de uma URL
  // fixa — o destino final depende do papel.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/login$/);

  await page.context().storageState({ path: authFile });
});
