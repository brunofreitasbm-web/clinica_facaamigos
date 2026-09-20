// scripts/alias-loader.mjs
// Hooks de resolução do Node para rodar scripts que importam módulos de
// `lib/` SEM bundler (o projeto não tem tsx): resolve o alias `@/…` do
// tsconfig para a raiz do projeto e completa a extensão (.ts/.tsx/index.ts)
// de imports relativos sem extensão feitos por arquivos do próprio projeto.
// Carregado por scripts/register-alias.mjs (`node --import`).
import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function tryFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = resolvePath(base, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) {
    base = resolvePath(ROOT, specifier.slice(2));
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parent = fileURLToPath(context.parentURL);
    if (parent.startsWith(ROOT) && !parent.includes("node_modules")) base = resolvePath(dirname(parent), specifier);
  }
  if (base) {
    const file = tryFile(base);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
