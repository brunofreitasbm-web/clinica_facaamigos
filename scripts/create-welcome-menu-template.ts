// scripts/create-welcome-menu-template.ts
//
// Cria na Twilio (Content API) os conteúdos do menu inicial do WhatsApp
// (lib/welcome-menu.ts). Todos são mensagens de SESSÃO: a família escreve
// primeiro, então não passam pela aprovação da Meta.
//
//   main        lista do menu principal (7 opções)
//   particular  lista do submenu Particular (4 opções + voltar)
//   navback     corpo variável + botão [↩ Voltar ao menu]
//   actions     corpo variável + botões [Agendar avaliação] [↩ Voltar]
//
// Os ids (menu_*, part_*, nav_back) chegam ao webhook como `ListId`/`ButtonPayload`
// e são lidos por lib/welcome-menu-pure.ts — não mude sem mudar lá. Todas as
// telas têm texto numerado de reserva: sem o SID configurado o bot usa o texto.
//
// Também dá para criar pelo botão "Criar menu interativo" em Chatbot > Configurações (guarda os
// identificadores no banco, sem variável de ambiente). As duas rotas usam as mesmas definições
// (lib/welcome-menu-contents-pure.ts).
//
// Por padrão só MOSTRA o que seria criado. Para criar de verdade:
//   npx tsx scripts/create-welcome-menu-template.ts --confirm            (os 4)
//   npx tsx scripts/create-welcome-menu-template.ts --confirm --only=main
// Prefixo `fa_clinica_`: a conta Twilio também guarda os templates do Playground/Circuito.
import fs from "fs";
import path from "path";
import twilio from "twilio";
import { WELCOME_CONTENTS as TEMPLATES, contentCreatePayload } from "../lib/welcome-menu-contents-pure.ts";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    }
  }
}

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const selected = only ? TEMPLATES.filter((t) => t.key === only) : TEMPLATES;
  if (selected.length === 0) {
    console.error(`--only=${only} inválido. Use: ${TEMPLATES.map((t) => t.key).join(", ")}`);
    process.exit(1);
  }

  for (const t of selected) {
    console.log(`──── ${t.key} · ${t.friendlyName} · sessão (sem aprovação da Meta)`);
    console.log(`${t.preview}\n`);
  }

  if (!process.argv.includes("--confirm")) {
    console.log("Nada foi enviado à Twilio. Rode com --confirm para criar.");
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.error("ERRO: TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN não definidos no .env.local");
    process.exit(1);
  }
  const client = twilio(accountSid, authToken);

  const results: { envVar: string; sid: string }[] = [];
  for (const t of selected) {
    try {
      // Corpo cru da REST API (snake_case); os tipos do SDK são camelCase, daí o cast.
      const content = await client.content.v1.contents.create(contentCreatePayload(t) as never);
      console.log(`[${t.key}] conteúdo criado: ${content.sid}`);
      results.push({ envVar: t.envVar, sid: content.sid });
    } catch (err) {
      const e = err as { message?: string; code?: number };
      console.error(`[${t.key}] ERRO: ${e.message ?? err}${e.code ? ` (código ${e.code})` : ""}`);
    }
  }

  console.log("\nConfigure na Vercel (e no .env.local) e faça um novo deploy:");
  for (const r of results) console.log(`${r.envVar}=${r.sid}`);
}

main().catch((err) => {
  console.error("Erro:", err?.message ?? err);
  process.exit(1);
});
