import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Checagem ESTÁTICA de acessibilidade da Fila de entrada (spec, fase 5: texto mínimo de 14 px e
 * alvos de clique de 40 px). Lê o código-fonte e procura as classes Tailwind que violam as regras.
 * Não mede pixels renderizados: isso fica para o Playwright no preview (ver o doc de medição).
 *
 * Regras:
 *  1. Nenhum tamanho de fonte abaixo de 14 px: `text-xs` (12 px) e `text-[Npx]` com N < 14.
 *     (`text-sm` = 14 px é o mínimo permitido.)
 *  2. Nenhum `uppercase` (texto em caixa alta é mais difícil de ler).
 *  3. Todo elemento interativo tem altura mínima de 40 px (`min-h-10`/`h-10` ou maior, ou
 *     `min-h-[Npx]`/`h-[Npx]` com N >= 40). Interativos: button, a, Link, summary, input (menos
 *     hidden), elementos com role="button"/"tab" e os botões locais PrimaryButton/SecondaryButton.
 *     Quando o className é um identificador (ex.: SECONDARY_CLASS), usa-se o valor da const do arquivo.
 *
 * Exceções permitidas (lista fechada abaixo, cada uma com justificativa):
 *  - Link dentro de uma frase (inline): WCAG 2.5.8 isenta alvos em linha de texto corrido.
 *  - Checkbox nativo: o alvo de clique é o <label> que o envolve, que tem min-h-10.
 */

const DIR = join(process.cwd(), "app/recepcao/a-autorizar");

function newScreenFiles(): string[] {
  const names = readdirSync(DIR).filter(
    (f) =>
      f.endsWith(".tsx") &&
      (f.startsWith("intake-") ||
        ["authorizations-workspace.tsx", "undo-toast.tsx", "chase-all-dialog.tsx", "page.tsx"].includes(f)),
  );
  return names.sort();
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
    const cn = /className=(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s|\/|>))/.exec(text);
    out.push({ name: m[1], text, line, className: cn ? (cn[1] ?? cn[2]) : null });
  }
  return out;
}

/** Valor literal de `const NOME = "..."` no arquivo (para className={NOME}). */
function resolveClass(src: string, expr: string): string {
  const id = /^[A-Z_][A-Z0-9_]*$/.exec(expr.trim());
  if (!id) return expr;
  const def = new RegExp(`const\\s+${id[0]}\\s*=\\s*([\\s\\S]*?);`).exec(src);
  return def ? def[1] : expr;
}

const SMALL_FONT = /(?<![\w-])text-(?:xs|\[(\d+(?:\.\d+)?)px\])(?![\w-])/g;

function smallFonts(classes: string): string[] {
  const bad: string[] = [];
  for (const m of classes.matchAll(SMALL_FONT)) {
    if (m[1] === undefined || Number(m[1]) < 14) bad.push(m[0]);
  }
  return bad;
}

function hasMinHeight40(classes: string): boolean {
  for (const m of classes.matchAll(/(?<![\w-])(?:min-h|h)-(\d+)(?![\w.-])/g)) if (Number(m[1]) >= 10) return true;
  for (const m of classes.matchAll(/(?<![\w-])(?:min-h|h)-\[(\d+)px\]/g)) if (Number(m[1]) >= 40) return true;
  return false;
}

const INTERACTIVE_TAGS = new Set(["button", "a", "Link", "summary", "input", "PrimaryButton", "SecondaryButton"]);

function isInteractive(tag: Tag): boolean {
  if (tag.name === "input") return !/type="hidden"/.test(tag.text);
  return INTERACTIVE_TAGS.has(tag.name) || /role="(?:button|tab)"/.test(tag.text);
}

/**
 * Exceções fechadas: arquivo + trecho que identifica a tag + justificativa. Quem adicionar uma linha
 * aqui precisa dizer por que o alvo menor é aceitável.
 */
const TARGET_EXCEPTIONS: { file: string; match: RegExp; why: string }[] = [
  {
    file: "authorizations-workspace.tsx",
    match: /type="checkbox"/,
    why: "Checkbox nativo: o alvo de clique é o <label> que o envolve (min-h-10).",
  },
  {
    file: "intake-detail.tsx",
    match: /pre-cadastros\/\$\{draft\.id\}`\}\s+className="font-semibold text-teal-800 underline/,
    why: "Link em linha dentro de uma frase do aviso de cadastro (WCAG 2.5.8).",
  },
];

function isExcepted(file: string, tag: Tag): string | null {
  const hit = TARGET_EXCEPTIONS.find((e) => e.file === file && e.match.test(tag.text));
  return hit ? hit.why : null;
}

test("os arquivos da Fila de entrada foram encontrados", () => {
  const names = files.map((f) => f.name);
  for (const required of [
    "authorizations-workspace.tsx",
    "undo-toast.tsx",
    "chase-all-dialog.tsx",
    "intake-detail.tsx",
    "intake-row.tsx",
    "page.tsx",
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
      // Wrappers locais (PrimaryButton/SecondaryButton) valem pela definição, não pelo uso.
      if (tag.name === "PrimaryButton" || tag.name === "SecondaryButton") continue;
      scanned++;
      if (isExcepted(name, tag)) continue;
      const classes = tag.className ? resolveClass(code, tag.className) : "";
      if (!hasMinHeight40(classes)) found.push(`${name}:${tag.line} <${tag.name}> sem min-h-10 ou h-10`);
    }
  }
  // Guarda contra um scanner que não enxerga nada (passaria vazio).
  assert.ok(scanned >= 20, `só ${scanned} elementos interativos analisados; o scanner pode estar quebrado`);
  assert.deepEqual(found, [], `alvos de clique baixos:\n${found.join("\n")}`);
});

test("botões locais PrimaryButton e SecondaryButton herdam altura de 40 px", () => {
  const src = stripComments(files.find((f) => f.name === "intake-detail.tsx")!.src);
  const primary = /function PrimaryButton[\s\S]*?className="([^"]*)"/.exec(src)?.[1] ?? "";
  const secondary = /const SECONDARY_CLASS\s*=\s*([\s\S]*?);/.exec(src)?.[1] ?? "";
  assert.ok(hasMinHeight40(primary), "PrimaryButton sem altura mínima");
  assert.ok(hasMinHeight40(secondary), "SECONDARY_CLASS sem altura mínima");
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
  const tags = openingTags('<div onClick={() => go()}><button type="button" className="px-2">x</button></div>');
  const button = tags.find((t) => t.name === "button")!;
  assert.equal(button.className, "px-2");
  assert.equal(isInteractive(button), true);
  assert.equal(isInteractive(tags[0]), false);
});
