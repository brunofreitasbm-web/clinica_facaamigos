import { chromium } from 'playwright';

const OUT_DIR = 'C:\\Users\\bruno\\AppData\\Local\\Temp\\claude\\c--Users-bruno-Documents-Projetos-Clinica\\32a32067-b0f7-42cf-b0d0-5a10f9a8e358\\scratchpad';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').first().fill('gestor@facaamigos.com.br');
await page.locator('input[type="password"]').first().fill('facaamigos123');
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle');

const patientId = 'd1f2d486-4e6e-4464-b102-8a2fa87fce9f';
const links = {
  ADL: `http://localhost:3000/terapeuta/paciente/${patientId}/fono/adl/5b1d19de-cff9-435e-91a3-61412970cc8d`,
  'ADL-2': `http://localhost:3000/terapeuta/paciente/${patientId}/fono/adl2/8c401dfc-316d-403b-bee9-ae08d2b1c099`,
  PROC: `http://localhost:3000/terapeuta/paciente/${patientId}/fono/proc/51ac070f-6252-4364-9666-cd51ad85759f`,
};

await page.emulateMedia({ media: 'print' });

for (const [name, url] of Object.entries(links)) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}\\print-${name}.png`, fullPage: true });
  await page.pdf({ path: `${OUT_DIR}\\print-${name}.pdf`, format: 'A4', printBackground: true });
}

await browser.close();
