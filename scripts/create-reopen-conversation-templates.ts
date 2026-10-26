/**
 * Templates WhatsApp (utility) para reabrir conversa com famílias de pacientes
 * cadastrados fora da janela de 24h.
 *
 *   node --experimental-strip-types scripts/create-reopen-conversation-templates.ts
 *       -> dry-run: valida e imprime os payloads. Não toca na Twilio nem na Meta.
 *   ... --create
 *       -> cria os conteúdos na Twilio Content API (ainda NÃO vão para a Meta).
 *   ... --submit
 *       -> envia os conteúdos já criados (por friendly_name) para aprovação da Meta
 *          como UTILITY. Só rode depois de revisar os textos.
 *
 * Usa fetch direto na REST API (sem o SDK) para o dry-run funcionar sem dependências.
 */
import fs from "node:fs";
import path from "node:path";

type ReopenTemplate = {
  name: string;
  body: string;
  variables: Record<string, string>;
  buttons: { title: string; id: string }[];
};

export const REOPEN_TEMPLATES: ReopenTemplate[] = [
  {
    name: "retomar_contato_familia",
    body: "Olá, {{1}}! Aqui é a Clínica Faça Amigos. Precisamos conversar com você sobre o atendimento de {{2}}. Pode nos responder por aqui quando puder?",
    variables: { "1": "Maria", "2": "Lucas" },
    buttons: [
      { title: "Pode falar", id: "reopen_pode_falar" },
      { title: "Prefiro ligação", id: "reopen_prefiro_ligacao" },
    ],
  },
  {
    name: "contato_sobre_atendimento",
    body: "Olá, {{1}}! Aqui é a Clínica Faça Amigos. Estamos entrando em contato sobre o atendimento de {{2}}: {{3}}. Responda esta mensagem para continuarmos a conversa por aqui.",
    variables: { "1": "Maria", "2": "Lucas", "3": "confirmar o horário da próxima sessão" },
    buttons: [
      { title: "Responder agora", id: "reopen_responder_agora" },
      { title: "Falar com atendente", id: "reopen_falar_atendente" },
    ],
  },
];

const BODY_MAX = 1024;
const BUTTON_TITLE_MAX = 20; // limite do WhatsApp para quick reply
const MAX_BUTTONS = 3;

/** Regras da Meta/Twilio que costumam causar reprovação. Retorna a lista de problemas. */
export function validateTemplate(t: ReopenTemplate): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_]+$/.test(t.name)) problems.push("nome deve ser minúsculo, números e underscore");
  if (t.body.length > BODY_MAX) problems.push(`corpo com ${t.body.length} caracteres (máx ${BODY_MAX})`);
  if (/^\s*\{\{/.test(t.body)) problems.push("variável no início do corpo");
  if (/\}\}[\s.!?]*$/.test(t.body)) problems.push("variável no fim do corpo");
  if (/\}\}\s*\{\{/.test(t.body)) problems.push("variáveis consecutivas");
  const used = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
  const expected = used.map((_, i) => String(i + 1));
  if (used.join(",") !== expected.join(",")) problems.push(`variáveis fora de sequência: ${used.join(",")}`);
  for (const key of used) {
    if (!(key in t.variables)) problems.push(`variável {{${key}}} sem valor de exemplo`);
  }
  for (const [key, value] of Object.entries(t.variables)) {
    if (/[\n\t]/.test(value) || / {4,}/.test(value)) problems.push(`exemplo de {{${key}}} com quebra de linha/tab/4+ espaços`);
  }
  if (t.buttons.length === 0 || t.buttons.length > MAX_BUTTONS) problems.push(`botões: ${t.buttons.length} (1 a ${MAX_BUTTONS})`);
  for (const b of t.buttons) {
    if (b.title.length > BUTTON_TITLE_MAX) problems.push(`botão "${b.title}" com ${b.title.length} caracteres (máx ${BUTTON_TITLE_MAX})`);
  }
  return problems;
}

function toContentPayload(t: ReopenTemplate) {
  return {
    friendly_name: t.name,
    language: "pt_BR",
    variables: t.variables,
    types: {
      "twilio/quick-reply": {
        body: t.body,
        actions: t.buttons,
      },
    },
  };
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    }
  }
}

async function twilioFetch(url: string, init: { method: string; body?: unknown }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN ausentes no .env.local");
  const res = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function findContentSid(friendlyName: string): Promise<string | null> {
  let url: string | null = "https://content.twilio.com/v1/Content?PageSize=100";
  while (url) {
    const page = (await twilioFetch(url, { method: "GET" })) as {
      contents?: { sid: string; friendly_name: string }[];
      meta?: { next_page_url?: string | null };
    };
    const hit = page.contents?.find((c) => c.friendly_name === friendlyName);
    if (hit) return hit.sid;
    url = page.meta?.next_page_url ?? null;
  }
  return null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const create = args.has("--create");
  const submit = args.has("--submit");

  let invalid = false;
  for (const t of REOPEN_TEMPLATES) {
    const problems = validateTemplate(t);
    console.log(`\n=== ${t.name} ===`);
    console.log(t.body);
    console.log(`Botões: ${t.buttons.map((b) => b.title).join(" | ")}`);
    console.log(problems.length ? `PROBLEMAS: ${problems.join("; ")}` : "Validação local: OK");
    if (problems.length) invalid = true;
  }
  if (invalid) process.exit(1);

  if (!create && !submit) {
    console.log("\nDry-run. Nada foi criado nem enviado. Use --create e depois --submit.");
    return;
  }

  loadEnvLocal();

  if (create) {
    for (const t of REOPEN_TEMPLATES) {
      if (await findContentSid(t.name)) {
        console.log(`${t.name}: já existe na Twilio, pulando.`);
        continue;
      }
      const created = await twilioFetch("https://content.twilio.com/v1/Content", { method: "POST", body: toContentPayload(t) });
      console.log(`${t.name}: criado (${created.sid}). Ainda não enviado à Meta.`);
    }
  }

  if (submit) {
    for (const t of REOPEN_TEMPLATES) {
      const sid = await findContentSid(t.name);
      if (!sid) {
        console.log(`${t.name}: não encontrado na Twilio. Rode --create antes.`);
        continue;
      }
      await twilioFetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
        method: "POST",
        body: { name: t.name, category: "UTILITY" },
      });
      console.log(`${t.name} (${sid}): enviado para aprovação da Meta como UTILITY.`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
