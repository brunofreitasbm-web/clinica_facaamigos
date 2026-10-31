// lib/welcome-menu-contents-pure.ts
// Definições dos 4 conteúdos da Twilio (Content API) do menu inicial do WhatsApp.
// Usadas pelo botão "Criar menu interativo" (app/recepcao/atendimento/chatbot/settings-actions.ts)
// e pelo script de linha de comando (scripts/create-welcome-menu-template.ts), para os dois
// criarem exatamente a mesma coisa. Todos são mensagens de SESSÃO (a família escreve primeiro):
// não passam pela aprovação da Meta. PURO, sem import com alias `@/`, para rodar em
// `node --test --experimental-strip-types` (tests/welcome-menu-contents-pure.test.ts).
import {
  LIST_DESCRIPTION_MAX,
  LIST_ITEMS_MAX,
  LIST_TITLE_MAX,
  PARTICULAR_MENU_BODY,
  PARTICULAR_MENU_OPTIONS,
  WELCOME_MENU_BODY,
  WELCOME_MENU_OPTIONS,
  type MenuOption,
} from "./welcome-menu-pure.ts";

export type WelcomeContentKey = "main" | "particular" | "navback" | "actions";

export type WelcomeContentDefinition = {
  key: WelcomeContentKey;
  /** Nome na Twilio. O prefixo `fa_clinica_` separa de Playground/Circuito, que usam a mesma conta. */
  friendlyName: string;
  /** Variável de ambiente equivalente (reserva, e o que o script imprime). */
  envVar: string;
  /** Coluna de `chatbot_settings` onde o identificador (HX...) fica gravado. */
  column: WelcomeContentColumn;
  /** Nome que o painel mostra. */
  label: string;
  variables: Record<string, string>;
  /** Corpo cru da REST API (chaves em snake_case, "twilio/list-picker"). */
  types: Record<string, unknown>;
  preview: string;
};

export type WelcomeContentColumn =
  | "welcome_menu_content_sid"
  | "particular_menu_content_sid"
  | "nav_back_content_sid"
  | "particular_actions_content_sid";

/** Valida os limites do WhatsApp para uma lista interativa e monta os itens. */
export function buildListItems(options: MenuOption[]) {
  if (options.length > LIST_ITEMS_MAX) throw new Error(`Lista com ${options.length} itens (máximo ${LIST_ITEMS_MAX}).`);
  return options.map((o) => {
    if (o.title.length > LIST_TITLE_MAX) throw new Error(`Título "${o.title}" passa de ${LIST_TITLE_MAX} caracteres.`);
    if ((o.description ?? "").length > LIST_DESCRIPTION_MAX) throw new Error(`Descrição de "${o.title}" passa de ${LIST_DESCRIPTION_MAX} caracteres.`);
    return { item: o.title, id: o.id, description: o.description ?? "" };
  });
}

const listPreview = (body: string, options: MenuOption[]) => `${body}\n[ ☰ Ver opções ] → ${options.map((o) => o.title).join(" · ")}`;

export const WELCOME_CONTENTS: WelcomeContentDefinition[] = [
  {
    key: "main",
    friendlyName: "fa_clinica_menu_inicial_v1",
    envVar: "TWILIO_WELCOME_MENU_CONTENT_SID",
    column: "welcome_menu_content_sid",
    label: "Menu principal",
    variables: {},
    types: { "twilio/list-picker": { body: WELCOME_MENU_BODY, button: "Ver opções", items: buildListItems(WELCOME_MENU_OPTIONS) } },
    preview: listPreview(WELCOME_MENU_BODY, WELCOME_MENU_OPTIONS),
  },
  {
    key: "particular",
    friendlyName: "fa_clinica_menu_particular_v1",
    envVar: "TWILIO_PARTICULAR_MENU_CONTENT_SID",
    column: "particular_menu_content_sid",
    label: "Submenu Particular",
    variables: {},
    types: { "twilio/list-picker": { body: PARTICULAR_MENU_BODY, button: "Ver opções", items: buildListItems(PARTICULAR_MENU_OPTIONS) } },
    preview: listPreview(PARTICULAR_MENU_BODY, PARTICULAR_MENU_OPTIONS),
  },
  {
    key: "navback",
    friendlyName: "fa_clinica_menu_voltar_v1",
    envVar: "TWILIO_NAV_BACK_CONTENT_SID",
    column: "nav_back_content_sid",
    label: "Botão Voltar ao menu",
    variables: { "1": "Texto da tela" },
    types: { "twilio/quick-reply": { body: "{{1}}", actions: [{ title: "↩ Voltar ao menu", id: "nav_back" }] } },
    preview: "{{1}}\n[ ↩ Voltar ao menu ]",
  },
  {
    key: "actions",
    friendlyName: "fa_clinica_menu_particular_acoes_v1",
    envVar: "TWILIO_PARTICULAR_ACTIONS_CONTENT_SID",
    column: "particular_actions_content_sid",
    label: "Botões do Particular (Agendar / Voltar)",
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

/** Corpo da chamada `client.content.v1.contents.create` para um conteúdo. */
export function contentCreatePayload(def: WelcomeContentDefinition) {
  return { friendly_name: def.friendlyName, language: "pt_BR", variables: def.variables, types: def.types };
}
