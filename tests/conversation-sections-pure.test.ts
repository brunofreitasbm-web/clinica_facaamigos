// tests/conversation-sections-pure.test.ts
//
// Seções da lista de conversas do Chat: "Precisa de você", "Em atendimento" e "Com o bot".
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_LABELS,
  sectionConversations,
  sectionOf,
  waitAlertMinutes,
} from "../lib/atendimento/sections-pure.ts";

const ME = "user-me";
const OTHER = "user-other";

type Row = Parameters<typeof sectionOf>[0] & { id: string };
const mk = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  status: "open",
  escalationReason: null,
  assignedTo: null,
  isBotActive: true,
  lastMessageSender: "bot",
  lastInboundAt: "2026-11-09T10:00:00Z",
  lastMessageAt: "2026-11-09T10:00:00Z",
  ...over,
});

test("prioridade (pediu humano / particular) sem dono vai para 'Precisa de você'", () => {
  assert.equal(sectionOf(mk("a", { status: "pending", escalationReason: "pediu_humano", isBotActive: false }), ME), "precisa");
  assert.equal(sectionOf(mk("b", { status: "pending", escalationReason: "particular_agendar", isBotActive: false }), ME), "precisa");
});

test("escalada para a equipe e aguardando, sem dono: precisa de você", () => {
  const c = mk("c", { status: "pending", isBotActive: false, lastMessageSender: "contact", escalationReason: "fora_da_base" });
  assert.equal(sectionOf(c, ME), "precisa");
});

test("aguardando e atribuída a mim: continua precisando de mim", () => {
  const c = mk("d", { status: "open", isBotActive: false, assignedTo: ME, lastMessageSender: "contact" });
  assert.equal(sectionOf(c, ME), "precisa");
});

test("aguardando mas atribuída a OUTRA pessoa: está 'Em atendimento', não é minha fila", () => {
  const c = mk("e", { status: "open", isBotActive: false, assignedTo: OTHER, lastMessageSender: "contact" });
  assert.equal(sectionOf(c, ME), "atendimento");
});

test("humano no controle e a clínica falou por último: 'Em atendimento'", () => {
  const c = mk("f", { isBotActive: false, assignedTo: ME, lastMessageSender: "agent" });
  assert.equal(sectionOf(c, ME), "atendimento");
});

test("o contato escreveu e o BOT está respondendo: não infla 'Precisa de você'", () => {
  const c = mk("g", { isBotActive: true, status: "open", lastMessageSender: "contact" });
  assert.equal(sectionOf(c, ME), "bot");
});

test("bot ativo, sem dono, sem espera: 'Com o bot'", () => {
  assert.equal(sectionOf(mk("h"), ME), "bot");
});

test("sem usuário logado, conversa atribuída a alguém nunca é 'minha'", () => {
  const c = mk("i", { isBotActive: false, assignedTo: OTHER, lastMessageSender: "contact" });
  assert.equal(sectionOf(c, null), "atendimento");
});

test("seções vazias não aparecem e a ordem é Precisa, Em atendimento, Bot", () => {
  const rows = [mk("bot1"), mk("hum1", { isBotActive: false, assignedTo: ME, lastMessageSender: "agent" })];
  const sections = sectionConversations(rows, ME);
  assert.deepEqual(sections.map((s) => s.key), ["atendimento", "bot"]);
  assert.equal(sections[0].label, SECTION_LABELS.atendimento);
});

test("'Precisa de você': prioridade primeiro, depois quem espera há MAIS tempo", () => {
  const prio = mk("prio", { status: "pending", escalationReason: "pediu_humano", isBotActive: false, lastInboundAt: "2026-11-09T12:00:00Z" });
  const antiga = mk("antiga", { status: "pending", isBotActive: false, lastMessageSender: "contact", lastInboundAt: "2026-11-09T08:00:00Z" });
  const recente = mk("recente", { status: "pending", isBotActive: false, lastMessageSender: "contact", lastInboundAt: "2026-11-09T11:00:00Z" });
  const [precisa] = sectionConversations([recente, antiga, prio], ME);
  assert.deepEqual(precisa.rows.map((r) => r.id), ["prio", "antiga", "recente"]);
});

test("fora de 'Precisa de você' a ordem recebida (por última mensagem) é mantida", () => {
  const rows = [mk("b3"), mk("b1"), mk("b2")];
  const [bot] = sectionConversations(rows, ME);
  assert.deepEqual(bot.rows.map((r) => r.id), ["b3", "b1", "b2"]);
});

test("nenhuma conversa se perde nem se duplica", () => {
  const rows = [
    mk("1", { status: "pending", escalationReason: "pediu_humano", isBotActive: false }),
    mk("2", { isBotActive: false, assignedTo: OTHER, lastMessageSender: "agent" }),
    mk("3"),
    mk("4", { status: "pending", isBotActive: false, lastMessageSender: "contact" }),
  ];
  const ids = sectionConversations(rows, ME).flatMap((s) => s.rows.map((r) => r.id)).sort();
  assert.deepEqual(ids, ["1", "2", "3", "4"]);
});

test("limite de espera segue a configuração; 0, nulo ou inválido usam 15 min", () => {
  assert.equal(waitAlertMinutes(30), 30);
  assert.equal(waitAlertMinutes(10), 10);
  assert.equal(waitAlertMinutes(0), 15);
  assert.equal(waitAlertMinutes(null), 15);
  assert.equal(waitAlertMinutes(undefined), 15);
  assert.equal(waitAlertMinutes(-5), 15);
  assert.equal(waitAlertMinutes(Number.NaN), 15);
});
