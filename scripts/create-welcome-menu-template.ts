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
// Por padrão só MOSTRA o que seria criado. Para criar de verdade:
//   npx tsx scripts/create-welcome-menu-template.ts --confirm            (os 4)
//   npx tsx scripts/create-welcome-menu-template.ts --confirm --only=main
// Prefixo `fa_clinica_`: a conta Twilio também guarda os templates do Playground/Circuito.
import fs from "fs";
import path from "path";
import twilio from "twilio";
import {
  LIST_DESCRIPTION_MAX,
  LIST_ITEMS_MAX,
  LIST_TITLE_MAX,
  PARTICULAR_MENU_BODY,
  PARTICULAR_MENU_OPTIONS,
  WELCOME_MENU_BODY,
  WELCOME_MENU_OPTIONS,
  type MenuOption,
} from "../lib/welcome-menu-pure.ts";

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

type Template = {
  key: "main" | "particular" | "navback" | "actions";
  friendlyName: string;
  envVar: string;
  variables: Record<string, string>;
  types: Record<string, unknown>;
  preview: string;
};

function listItems(options: MenuOption[]) {
  if (options.length > LIST_ITEMS_MAX) throw new Error(`Lista com ${options.length} itens (máximo ${LIST_ITEMS_MAX}).`);
  return options.map((o) => {
    if (o.title.length > LIST_TITLE_MAX) throw new Error(`Título "${o.title}" passa de ${LIST_TITLE_MAX} caracteres.`);
    if ((o.description ?? "").length > LIST_DESCRIPTION_MAX) throw new Error(`Descrição de "${o.title}" passa de ${LIST_DESCRIPTION_MAX} caracteres.`);
    return { item: o.title, id: o.id, description: o.description ?? "" };
  });
}

const preview = (body: string, options: MenuOption[]) => `${body}\n[ ☰ Ver opções ] → ${options.map((o) => o.title).join(" · ")}`;

const TEMPLATES: Template[] = [
  {
    key: "main",
    friendlyName: "fa_clinica_menu_inicial_v1",
    envVar: "TWILIO_WELCOME_MENU_CONTENT_SID",
    variables: {},
    types: { "twilio/list-picker": { body: WELCOME_MENU_BODY, button: "Ver opções", items: listItems(WELCOME_MENU_OPTIONS) } },
    preview: preview(WELCOME_MENU_BODY, WELCOME_MENU_OPTIONS),
  },
  {
    key: "particular",
    friendlyName: "fa_clinica_menu_particular_v1",
    envVar: "TWILIO_PARTICULAR_MENU_CONTENT_SID",
    variables: {},
    types: { "twilio/list-picker": { body: PARTICULAR_MENU_BODY, button: "Ver opções", items: listItems(PARTICULAR_MENU_OPTIONS) } },
    preview: preview(PARTICULAR_MENU_BODY, PARTICULAR_MENU_OPTIONS),
  },
  {
    key: "navback",
    friendlyName: "fa_clinica_menu_voltar_v1",
    envVar: "TWILIO_NAV_BACK_CONTENT_SID",
    variables: { "1": "Texto da tela" },
    types: { "twilio/quick-reply": { body: "{{1}}", actions: [{ title: "↩ Voltar ao menu", id: "nav_back" }] } },
    preview: "{{1}}\n[ ↩ Voltar ao menu ]",
  },
  {
    key: "actions",
    friendlyName: "fa_clinica_menu_particular_acoes_v1",
    envVar: "TWILIO_PARTICULAR_ACTIONS_CONTENT_SID",
    variables: { "1": "Texto da tela" },
    types: {
      "twilio/quick-reply": {
        body: "{{1}}",
        actions: [
          { title: "Agendar avaliação", id: "part_agendar" },
          { title: "↩ Voltar", id: "nav_back" },
        ],
      },
    },
    preview: "{{1}}\n[ Agendar avaliação ]  [ ↩ Voltar ]",
  },
];

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
      const content = await client.content.v1.contents.create({
        friendly_name: t.friendlyName,
        language: "pt_BR",
        variables: t.variables,
        types: t.types,
      } as never);
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
