// lib/atendimento/quick-responses-pure.ts
// Respostas rápidas do campo de mensagem. PURO, sem I/O.
//
// Bug que motivou: com o popover aberto o Enter só era tratado como "enviar", então digitar
// "/endereco" e apertar Enter mandava o texto "/endereco" ao paciente. Aqui fica a regra de
// teclado: no modo atalho o Enter escolhe o item (ou não faz nada), nunca envia.

/** O rascunho é uma busca de atalho ("/end"): começa com "/" e ainda não tem espaço nem quebra de linha. */
export function isShortcutDraft(draft: string): boolean {
  return /^\/\S*$/.test(draft);
}

type Searchable = { shortcut: string; title: string };

/** Atalho começa com o texto digitado OU o título contém (sem diferenciar maiúsculas). */
export function filterQuickResponses<T extends Searchable>(rows: T[], draft: string): T[] {
  const q = draft.replace(/^\//, "").toLowerCase();
  return rows.filter(
    (r) => r.shortcut.replace(/^\//, "").toLowerCase().startsWith(q) || r.title.toLowerCase().includes(q),
  );
}

/** Move o item destacado com volta nas pontas; índice fora do alcance (lista encolheu) é corrigido. */
export function moveActiveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  const clamped = Math.min(Math.max(current, 0), length - 1);
  return (((clamped + delta) % length) + length) % length;
}

export type EnterDecision = "select" | "ignore" | "send" | "newline";

/**
 * O que a tecla Enter faz no campo de mensagem.
 *  • Shift+Enter e composição de IME: quebra de linha (nada a fazer).
 *  • Modo atalho com resultado: escolhe o item destacado.
 *  • Modo atalho sem resultado: ignora. "/abc" é quase sempre um atalho errado, não uma mensagem.
 *  • Demais casos: envia.
 */
export function decideEnterKey(input: {
  draft: string;
  matches: number;
  shiftKey: boolean;
  composing: boolean;
}): EnterDecision {
  if (input.shiftKey || input.composing) return "newline";
  if (isShortcutDraft(input.draft)) return input.matches > 0 ? "select" : "ignore";
  return "send";
}
