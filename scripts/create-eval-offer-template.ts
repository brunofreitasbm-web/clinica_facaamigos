// scripts/create-eval-offer-template.ts
//
// Cria na Twilio (Content API) os 4 conteúdos do fluxo automático de oferta da
// 1ª avaliação (lib/evaluation-offer.ts) e envia os 3 que exigem aprovação para
// a Meta como UTILITY:
//
//   offer     "O plano autorizou o atendimento de {{2}} — podemos agendar?"     [Quero agendar] [Agora não]
//   reminder  lembrete com 24h sem resposta                                      [Ver horários]  [Agora não]
//   confirm   confirmação final do horário (substitui a mensagem livre)          (sem botões)
//   list      menu com 3 horários — mensagem de SESSÃO (janela de 24h aberta pela
//             resposta do responsável): é criada, mas não passa pela Meta.
//
// Todos terminam com a assinatura "FaçaAmigos - Centro de Terapia Comportamental".
// Os ids dos botões/itens (eval_yes, eval_no, slot_1..3, none, human) chegam ao
// webhook como `ButtonPayload`/`ListId` e são lidos por
// lib/evaluation-offer-reply-pure.ts — não mude sem mudar lá.
//
// Por padrão só MOSTRA o que seria criado. Para criar de verdade:
//   npx tsx scripts/create-eval-offer-template.ts --confirm            (os 4)
//   npx tsx scripts/create-eval-offer-template.ts --confirm --only=offer
//
// `allow_category_change: false`: se a Meta entender que a mensagem é
// marketing, ela REJEITA em vez de reclassificar sozinha (marketing é cobrado
// mais caro e a decisão de mudar o texto deve ser nossa).
// Prefixo `fa_clinica_`: a conta Twilio também guarda os templates do Playground/Circuito
// (`fa_visita_*`, `fa_oferta_*`, `fa_lc_*`...). O prefixo mantém os dois domínios separados.
import fs from "fs";
import path from "path";
import twilio from "twilio";

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

/** Mesma constante de lib/evaluation-offer.ts::BRAND_LINE. */
const BRAND_LINE = "FaçaAmigos - Centro de Terapia Comportamental";

type Template = {
  key: "offer" | "reminder" | "confirm" | "list" | "invite" | "guidance";
  /** Nome na Meta (minúsculas, números e _). */
  metaName: string;
  friendlyName: string;
  envVar: string;
  needsApproval: boolean;
  variables: Record<string, string>;
  // Corpo do `types` no formato da REST API da Content API.
  types: Record<string, unknown>;
  preview: string;
};

// Regras da Meta para aprovar: corpo não começa nem termina com variável e
// nenhuma variável fica ao lado de outra. Por isso todos fecham com a BRAND_LINE.
const OFFER_BODY =
  "Olá, {{1}}! 💙\n\n" +
  "O plano de saúde autorizou o atendimento de {{2}} no FaçaAmigos.\n\n" +
  "Podemos agendar a 1ª avaliação agora? Toque em uma das opções abaixo.\n\n" +
  BRAND_LINE;

const REMINDER_BODY =
  "Olá, {{1}}! 💙\n\n" +
  "Ainda aguardamos sua resposta para agendar a 1ª avaliação de {{2}}, autorizada pelo plano de saúde. " +
  "Toque em uma das opções abaixo.\n\n" +
  BRAND_LINE;

const CONFIRM_BODY =
  "Olá, {{1}}! 💙\n\n" +
  "A 1ª avaliação de {{2}} está confirmada.\n\n" +
  "📅 Data e horário: {{3}}\n" +
  "👤 Profissional: {{4}}\n\n" +
  "Chegue com 15 minutos de antecedência e traga documento com foto do responsável e da criança. " +
  "Se tiver laudos, encaminhamentos ou relatórios anteriores, traga-os também.\n\n" +
  BRAND_LINE;

// Convite da pré-anamnese (lib/anamnesis-prefill.ts): enviado junto com a confirmação do horário.
// Os ids dos botões (preanam_yes/preanam_no) são lidos por lib/twilio-preanamnesis-bot.ts.
const INVITE_BODY =
  "Olá, {{1}}! 💙\n\n" +
  "A 1ª avaliação de {{2}} está marcada para {{3}}. Para o terapeuta chegar mais preparado, gostaríamos de fazer 5 perguntas rápidas por aqui. " +
  "As respostas serão aprofundadas na consulta e não substituem a avaliação presencial.\n\n" +
  "Podemos começar?\n\n" +
  BRAND_LINE;

// Orientações (lib/evaluation-guidance-pure.ts): entre a confirmação e o convite da pré-anamnese.
const GUIDANCE_BODY =
  "✅ Seu 1º agendamento está confirmado! 🎉\n\n" +
  "⏰ No dia da avaliação, chegue com 15 minutos de antecedência.\n\n" +
  "📂 Traga todos os exames, laudos e documentações de {{1}}. 🧩💙\n\n" +
  BRAND_LINE;

// Mensagem de sessão: o corpo pode abrir com variável (não passa pela Meta).
const LIST_BODY = "{{1}}\n\n" + BRAND_LINE;

const TEMPLATES: Template[] = [
  {
    key: "offer",
    metaName: "fa_clinica_plano_autorizado",
    friendlyName: "fa_clinica_plano_autorizado_v1",
    envVar: "TWILIO_EVAL_OFFER_TEMPLATE_CONTENT_SID",
    needsApproval: true,
    variables: { "1": "Nome do responsável", "2": "Nome da criança" },
    types: {
      "twilio/quick-reply": {
        body: OFFER_BODY,
        actions: [
          { title: "Quero agendar", id: "eval_yes" },
          { title: "Agora não", id: "eval_no" },
        ],
      },
    },
    preview: OFFER_BODY + "\n[ Quero agendar ]  [ Agora não ]",
  },
  {
    key: "reminder",
    metaName: "fa_clinica_lembrete_agendamento",
    friendlyName: "fa_clinica_lembrete_agendamento_v1",
    envVar: "TWILIO_EVAL_REMINDER_TEMPLATE_CONTENT_SID",
    needsApproval: true,
    variables: { "1": "Nome do responsável", "2": "Nome da criança" },
    types: {
      "twilio/quick-reply": {
        body: REMINDER_BODY,
        actions: [
          { title: "Ver horários", id: "eval_yes" },
          { title: "Agora não", id: "eval_no" },
        ],
      },
    },
    preview: REMINDER_BODY + "\n[ Ver horários ]  [ Agora não ]",
  },
  {
    key: "confirm",
    metaName: "fa_clinica_avaliacao_confirmada",
    friendlyName: "fa_clinica_avaliacao_confirmada_v1",
    envVar: "TWILIO_EVAL_CONFIRM_TEMPLATE_CONTENT_SID",
    needsApproval: true,
    variables: { "1": "Nome do responsável", "2": "Nome da criança", "3": "Data e horário", "4": "Profissional" },
    types: { "twilio/text": { body: CONFIRM_BODY } },
    preview: CONFIRM_BODY,
  },
  {
    key: "guidance",
    metaName: "fa_clinica_orientacoes_avaliacao",
    friendlyName: "fa_clinica_orientacoes_avaliacao_v1",
    envVar: "TWILIO_EVAL_GUIDANCE_TEMPLATE_CONTENT_SID",
    needsApproval: true,
    variables: { "1": "Nome da criança" },
    types: { "twilio/text": { body: GUIDANCE_BODY } },
    preview: GUIDANCE_BODY,
  },
  {
    key: "invite",
    metaName: "fa_clinica_convite_pre_anamnese",
    friendlyName: "fa_clinica_convite_pre_anamnese_v1",
    envVar: "TWILIO_PREANAMNESE_INVITE_TEMPLATE_CONTENT_SID",
    needsApproval: true,
    variables: { "1": "Nome do responsável", "2": "Nome da criança", "3": "Data e horário" },
    types: {
      "twilio/quick-reply": {
        body: INVITE_BODY,
        actions: [
          { title: "Sim, vamos começar", id: "preanam_yes" },
          { title: "Preencher na clínica", id: "preanam_no" },
        ],
      },
    },
    preview: INVITE_BODY + "\n[ Sim, vamos começar ]  [ Preencher na clínica ]",
  },
  {
    key: "list",
    metaName: "fa_clinica_lista_horarios",
    friendlyName: "fa_clinica_lista_horarios_v1",
    envVar: "TWILIO_EVAL_SLOTLIST_CONTENT_SID",
    needsApproval: false,
    variables: { "1": "Texto de abertura", "2": "Horário 1", "3": "Horário 2", "4": "Horário 3" },
    types: {
      "twilio/list-picker": {
        body: LIST_BODY,
        button: "Ver horários",
        // Títulos de item: até 24 caracteres.
        items: [
          { item: "{{2}}", id: "slot_1", description: "" },
          { item: "{{3}}", id: "slot_2", description: "" },
          { item: "{{4}}", id: "slot_3", description: "" },
          // Sem "Falar com atendente": se "Ver outros horários" não render, o bot
          // encaminha ao atendente sozinho (lib/evaluation-offer.ts).
          { item: "Ver outros horários", id: "none", description: "" },
        ],
      },
    },
    preview: LIST_BODY + "\n[ ☰ Ver horários ] → {{2}} · {{3}} · {{4}} · Ver outros horários",
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
    console.log(`──── ${t.key} · ${t.metaName} · ${t.needsApproval ? "UTILITY (aprovação Meta)" : "sessão (sem aprovação)"}`);
    console.log(`${t.preview}\n`);
  }

  if (!process.argv.includes("--confirm")) {
    console.log("Nada foi enviado à Twilio. Rode com --confirm para criar (e submeter à aprovação os que precisam).");
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
      // O SDK posta o objeto como JSON cru, no formato da REST API (chaves em
      // snake_case e "twilio/quick-reply"); os tipos do SDK são camelCase, daí o cast.
      const content = await client.content.v1.contents.create({
        friendly_name: t.friendlyName,
        language: "pt_BR",
        variables: t.variables,
        types: t.types,
      } as never);
      console.log(`[${t.key}] conteúdo criado: ${content.sid}`);
      results.push({ envVar: t.envVar, sid: content.sid });

      if (t.needsApproval) {
        const approval = await client.content.v1.contents(content.sid).approvalCreate.create({
          name: t.metaName,
          category: "UTILITY",
          allow_category_change: false,
        } as never);
        console.log(`[${t.key}] enviado à Meta. Status: ${approval.status} | Categoria: ${approval.category}`);
      }
    } catch (err) {
      const e = err as { message?: string; code?: number };
      console.error(`[${t.key}] ERRO: ${e.message ?? err}${e.code ? ` (código ${e.code})` : ""}`);
    }
  }

  console.log("\nA aprovação da Meta leva de minutos a 48h. Quando estiver 'approved', configure na Vercel:");
  for (const r of results) console.log(`${r.envVar}=${r.sid}`);
}

main().catch((err) => {
  console.error("Erro:", err?.message ?? err);
  process.exit(1);
});
