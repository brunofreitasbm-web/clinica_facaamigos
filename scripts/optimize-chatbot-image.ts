// scripts/optimize-chatbot-image.ts
//
// Otimiza a arte enviada no WhatsApp (valores particulares): imagem de mensagem
// do WhatsApp só aceita JPEG ou PNG, e quanto menor o arquivo, mais rápido ela
// chega no celular da família. Gera um JPEG progressivo (mozjpeg, sRGB, sem
// metadados, lado maior de 1280 px, sem ampliar). Sempre grava JPEG: o bot
// procura planos-particular.jpg.
//
// Uso (troca simples da arte):
//   npx tsx scripts/optimize-chatbot-image.ts caminho/da/nova-arte.png
// Resultado: public/chatbot/planos-particular.jpg. Depois é
// só subir o arquivo e fazer o deploy. Para usar outro arquivo/URL sem deploy,
// preencha "Imagem de valores" em Chatbot > Configurações.
import fs from "fs";
import path from "path";
import sharp from "sharp";

const MAX_SIDE = 1280; // 1280 mantém legível a linha pequena de especialidades da arte
const TARGET_KB = 250;
const OUT_DIR = path.resolve(process.cwd(), "public/chatbot");
const OUT_BASE = "planos-particular";

async function main() {
  const input = process.argv[2];
  if (!input || !fs.existsSync(input)) {
    console.error("Uso: npx tsx scripts/optimize-chatbot-image.ts <imagem.png|jpg|webp>");
    process.exit(1);
  }

  const source = sharp(input, { failOn: "none" }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).toColorspace("srgb");
  const before = fs.statSync(input).size;

  // Qualidade 80 já é legível para texto pequeno; sobe até 85 se passar da meta.
  let jpeg = await source.clone().jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
  if (jpeg.length > TARGET_KB * 1024) jpeg = await source.clone().jpeg({ quality: 85, progressive: true, mozjpeg: true }).toBuffer();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${OUT_BASE}.jpg`);
  fs.writeFileSync(out, jpeg);

  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  console.log(`${path.basename(input)}: ${kb(before)} → ${path.relative(process.cwd(), out)}: ${kb(jpeg.length)}`);
  if (jpeg.length > TARGET_KB * 1024) console.warn(`Atenção: acima de ${TARGET_KB} KB. Considere uma arte mais simples.`);
}

main().catch((err) => {
  console.error("Erro:", err?.message ?? err);
  process.exit(1);
});
