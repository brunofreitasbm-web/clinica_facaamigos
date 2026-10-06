// lib/file-name.ts
//
// Helper único para montar nome de arquivo seguro para o Storage (antes
// duplicado em 5 arquivos). Sem imports com alias `@/` para poder ser
// testado com `node --test --experimental-strip-types`.

type SanitizeOptions = {
  /** Nome usado quando sobra nada depois da limpeza. */
  fallback?: string;
  /** Extensão (sem ponto) que substitui a do nome original — vem do tipo REAL do arquivo, nunca do nome enviado pelo usuário. */
  ext?: string;
};

export function sanitizeFileName(name: string, options: SanitizeOptions = {}): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!options.ext) return cleaned || options.fallback || "arquivo";

  const base = cleaned.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || (options.fallback ?? "arquivo").replace(/\.[A-Za-z0-9]{1,5}$/, "")}.${options.ext}`;
}
