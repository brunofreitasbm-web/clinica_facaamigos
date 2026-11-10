import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Checagem ESTÁTICA de acessibilidade da tela Fila (spec, fase 5: texto mínimo de 14 px e
 * alvos de clique de 40 px). Lê o código-fonte e procura as classes Tailwind que violam as regras.
 * Não mede pixels renderizados: isso fica para o Playwright no preview (ver o doc de medição).
 *
 * Regras:
 *  1. Nenhum tamanho de fonte abaixo de 14 px: `text-xs` (12 px), `text-[Npx]` com N < 14 e `text-[Nrem]` com N*16 < 14.
 *     (`text-sm` = 14 px é o mínimo permitido.)
 *  2. Nenhum `uppercase` (texto em caixa alta é mais difícil de ler).
 *  3. Todo elemento interativo tem altura mínima de 40 px (`min-h-10`/`h-10` ou maior, ou
 *     `min-h-[Npx]`/`h-[Npx]` com N >= 40). Só a classe SEM prefixo de breakpoint vale (md:h-10 não).
 *     Interativos: button, a, Link, summary, select, textarea, input (menos hidden), label com onClick,
 *     elementos com role="button"/"tab" e os botões locais PrimaryButton/SecondaryButton.
 *     Quando o className é um identificador (ex.: SECONDARY_CLASS), usa-se o valor da const do arquivo.
 *
 * Componentes compartilhados com Chat/Pendências (MoveToLastButton, ReassignOwnerButton, DraftAdjustButton,
 * AuthorizedGuideDialog, HelpHint) NÃO são varridos: a tag deles não aparece como button/a neste código e
 * mudar o interior afetaria outras telas. Ficam como exceção documentada, fora do escopo desta tela.
 *
 * Exceções permitidas (lista fechada abaixo, cada uma com justificativa):
 *  - Link dentro de uma frase (inline): WCAG 2.5.8 isenta alvos em linha de texto corrido.
 *  - Checkbox nativo: o alvo de clique é o <label> que o envolve, que tem min-h-10.
 */

const DIR = join(process.cwd(), "app/recepcao/fila");

function newScreenFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".tsx"))
    .sort();
}

const files = newScreenFiles().map((name) => ({ name, src: readFileSync(join(DIR, name), "utf8") }));

/** Remove comentários de linha e de bloco para não acusar texto de documentação. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

type Tag = { name: string; text: string; line: number; className: string | null };

/** Extrai as tags de abertura JSX, respeitando chaves e aspas (um `=>` ou `>` dentro de {} não fecha a tag). */
function openingTags(src: string): Tag[] {
  const out: Tag[] = [];
  const re = /<([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
        continue;
      }
      if (depth > 0 && (c === '"' || c === "'" || c === "`")) {
        quote = c;
        continue;
      }
      if (depth === 0 && (c === '"' || c === "'")) {
        quote = c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[i - 1] !== "=") break;
    }
    const text = src.slice(m.index, i + 1);
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ name: m[1], text, line, className: extractClassName(text) });
  }
  return out;
}

/** Valor de className: string literal ou expressão entre chaves (com chaves aninhadas de `${...}`). */
function extractClassName(tag: string): string | null {
  const lit = /className="([^"]*)"/.exec(tag);
  if (lit) return lit[1];
  const start = tag.indexOf("className={");
  if (start < 0) return null;
  let depth = 0;
  const from = start + "className={".length;
  for (let i = from; i < tag.length; i++) {
    if (tag[i] === "{") depth++;
    else if (tag[i] === "}") {
      if (depth === 0) return tag.slice(from, i);
      depth--;
    }
  }
  return null;
}

/**
 * Valor literal de `const nome = "..."` no arquivo, para className={nome} e para `${nome}` dentro de template
 * strings. Identificadores sem const literal no arquivo ficam como estão (e o alvo reprova por falta de classe).
 */
function resolveClass(src: string, expr: string): string {
  const lookup = (id: string): string | null => {
    const q = String.fromCharCode(96);
    const def = new RegExp("const\\s+" + id + "\\s*=\\s*(\"[^\"]*\"|" + q + "[^" + q + "]*" + q + ")\\s*;").exec(src);
    return def ? def[1] : null;
  };
  const bare = /^[A-Za-z_][A-Za-z0-9_]*$/.exec(expr.trim());
  if (bare) return lookup(bare[0]) ?? expr;
  return expr.replace(/\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g, (all, id) => lookup(id) ?? all);
}

// Pega text-xs e text-[Npx], text-[Nrem], text-[Nem] (rem e em contam como 16 px por unidade), com ou sem
// prefixo de breakpoint (md:text-xs também é texto pequeno em alguma largura).
const SMALL_FONT = /(?<![\w-])text-(?:xs|\[(\d+(?:\.\d+)?|\.\d+)(px|rem|em)\])(?![\w-])/g;

function smallFonts(classes: string): string[] {
  const bad: string[] = [];
  for (const m of classes.matchAll(SMALL_FONT)) {
    if (m[1] === undefined) {
      bad.push(m[0]);
      continue;
    }
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
    if (px < 14) bad.push(m[0]);
  }
  return bad;
}

// Só vale a classe SEM prefixo (h-10, min-h-10): `md:h-10` deixa o celular com alvo baixo. O lookbehind
// recusa ":" para não aceitar md:h-10, hover:h-10 etc.
function hasMinHeight40(classes: string): boolean {
  // globals.css garante .btn com min-height 48px e .input com 44px (conferido em teste abaixo).
  if (/(?<![\w:-])(?:btn|input)(?![\w-])/.test(classes)) return true;
  for (const m of classes.matchAll(/(?<![\w:-])(?:min-h|h)-(\d+)(?![\w.-])/g)) if (Number(m[1]) >= 10) return true;
  for (const m of classes.matchAll(/(?<![\w:-])(?:min-h|h)-\[(\d+)px\]/g)) if (Number(m[1]) >= 40) return true;
  for (const m of classes.matchAll(/(?<![\w:-])(?:min-h|h)-\[(\d+(?:\.\d+)?)rem\]/g)) if (Number(m[1]) * 16 >= 40) return true;
  return false;
}

const INTERACTIVE_TAGS = new Set(["button", "a", "Link", "summary", "input", "select", "textarea"]);

function isInteractive(tag: Tag): boolean {
  if (tag.name === "input") return !/type="hidden"/.test(tag.text);
  if (tag.name === "label") return /\bonClick=/.test(tag.text);
  return INTERACTIVE_TAGS.has(tag.name) || /role="(?:button|tab)"/.test(tag.text);
}

/**
 * Exceções fechadas: arquivo + trecho que identifica a tag + justificativa. Quem adicionar uma linha
 * aqui precisa dizer por que o alvo menor é aceitável.
 */
const TARGET_EXCEPTIONS: { file: string; match: RegExp; why: string }[] = [
  {
    file: "fila-next-step.tsx",
    match: /Enviar a mensagem de abertura/,
    why: "Botão em linha dentro da frase da janela de 24 h (WCAG 2.5.8 isenta alvos em texto corrido).",
  },
];

function isExcepted(file: string, tag: Tag): string | null {
  const hit = TARGET_EXCEPTIONS.find((e) => e.file === file && e.match.test(tag.text));
  return hit ? hit.why : null;
}

test("os arquivos da Fila foram encontrados", () => {
  const names = files.map((f) => f.name);
  for (const required of [
    "error.tsx",
    "fila-detail.tsx",
    "fila-next-step.tsx",
    "fila-workspace.tsx",
    "loading.tsx",
    "page.tsx",
    "undo-toast.tsx",
  ]) {
    assert.ok(names.includes(required), `arquivo esperado ausente: ${required}`);
  }
});

test("nenhum texto abaixo de 14 px (text-xs e text-[Npx] com N < 14)", () => {
  const found: string[] = [];
  for (const { name, src } of files) {
    const code = stripComments(src);
    code.split("\n").forEach((line, i) => {
      for (const bad of smallFonts(line)) found.push(`${name}:${i + 1} ${bad}`);
    });
  }
  assert.deepEqual(found, [], `texto abaixo de 14 px:\n${found.join("\n")}`);
});

test("nenhuma classe uppercase", () => {
  const found: string[] = [];
  for (const { name, src } of files) {
    stripComments(src)
      .split("\n")
      .forEach((line, i) => {
        if (/(?<![\w-])uppercase(?![\w-])/.test(line)) found.push(`${name}:${i + 1}`);
      });
  }
  assert.deepEqual(found, [], `uppercase em:\n${found.join("\n")}`);
});

test("todo elemento interativo tem altura mínima de 40 px", () => {
  const found: string[] = [];
  let scanned = 0;
  for (const { name, src } of files) {
    const code = stripComments(src);
    for (const tag of openingTags(code)) {
      if (!isInteractive(tag)) continue;
      scanned++;
      if (isExcepted(name, tag)) continue;
      const classes = tag.className ? resolveClass(code, tag.className) : "";
      if (!hasMinHeight40(classes)) found.push(`${name}:${tag.line} <${tag.name}> sem min-h-10 ou h-10`);
    }
  }
  // Guarda contra um scanner que não enxerga nada (passaria vazio).
  assert.ok(scanned >= 15, `só ${scanned} elementos interativos analisados; o scanner pode estar quebrado`);
  assert.deepEqual(found, [], `alvos de clique baixos:\n${found.join("\n")}`);
});

test("btn e input valem como 40 px porque o CSS garante", () => {
  assert.equal(hasMinHeight40("btn btn-secondary"), true);
  assert.equal(hasMinHeight40("input w-full"), true);
  assert.equal(hasMinHeight40("md:btn"), false);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(/\n\.btn \{[\s\S]*?\}/.exec(css)?.[0] ?? "", /min-height: 48px/);
  assert.match(/\n\.input \{[\s\S]*?\}/.exec(css)?.[0] ?? "", /min-height: 44px/);
});

test("o scanner reconhece as violações (autoteste das regras)", () => {
  assert.deepEqual(smallFonts("text-xs text-[11px] text-[13px] text-sm text-[14px] text-[15px] text-xsmall"), [
    "text-xs",
    "text-[11px]",
    "text-[13px]",
  ]);
  assert.equal(hasMinHeight40("px-3 py-2"), false);
  assert.equal(hasMinHeight40("min-h-9"), false);
  assert.equal(hasMinHeight40("min-h-10"), true);
  assert.equal(hasMinHeight40("inline-flex h-11"), true);
  assert.equal(hasMinHeight40("min-h-[44px]"), true);
  assert.equal(hasMinHeight40("min-h-[32px]"), false);
  assert.equal(hasMinHeight40("md:h-10"), false);
  assert.equal(hasMinHeight40("md:min-h-12 px-2"), false);
  assert.equal(hasMinHeight40("hover:h-11"), false);
  assert.equal(hasMinHeight40("px-2 md:h-10 min-h-10"), true);
  assert.equal(hasMinHeight40("min-h-[2.5rem]"), true);
  assert.deepEqual(smallFonts("text-[0.75rem] text-[0.875rem] text-[.8rem] md:text-xs"), ["text-[0.75rem]", "text-[.8rem]", "md:text-xs"].map((x) => x.replace(/^md:/, "")));
  const tags = openingTags('<div onClick={() => go()}><button type="button" className="px-2">x</button></div>');
  const button = tags.find((t) => t.name === "button")!;
  assert.equal(button.className, "px-2");
  assert.equal(isInteractive(button), true);
  const tpl = openingTags("<Link href={x} className={`${primaryClass} no-underline`}>")[0];
  assert.equal(hasMinHeight40(resolveClass('const primaryClass = "btn min-h-11";', tpl.className ?? "")), true);
  assert.equal(hasMinHeight40(resolveClass('const other = "px-2";', tpl.className ?? "")), false);
  assert.equal(isInteractive(tags[0]), false);
  assert.equal(isInteractive(openingTags("<select className=\"x\">")[0]), true);
  assert.equal(isInteractive(openingTags("<textarea />")[0]), true);
  assert.equal(isInteractive(openingTags("<label onClick={go}>")[0]), true);
  assert.equal(isInteractive(openingTags("<label className=\"x\">")[0]), false);
});
