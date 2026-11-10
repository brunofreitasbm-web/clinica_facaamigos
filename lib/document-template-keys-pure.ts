// lib/document-template-keys-pure.ts
// Formato de `messages.template_key` das cobranças de documento. PURO, sem import com alias `@/`
// (lib/document-request-templates.ts usa estas funções com a lista de documentos dele).

export const TEMPLATE_KEY_PREFIX = "documento_pendente:";

/** Separador das chaves quando uma única mensagem cobra vários documentos. */
export const TEMPLATE_KEY_SEPARATOR = "+";

/** `documento_pendente:a+b`; com uma chave só, `documento_pendente:a`. */
export function joinTemplateKeys(keys: readonly string[]): string {
  return `${TEMPLATE_KEY_PREFIX}${keys.join(TEMPLATE_KEY_SEPARATOR)}`;
}

/** `documento_pendente:a+b` -> [a, b] (só chaves conhecidas, sem repetição); o que não for cobrança -> []. */
export function splitTemplateKeys<K extends string>(raw: string | null | undefined, known: readonly K[]): K[] {
  if (!raw || !raw.startsWith(TEMPLATE_KEY_PREFIX)) return [];
  const out: K[] = [];
  for (const part of raw.slice(TEMPLATE_KEY_PREFIX.length).split(TEMPLATE_KEY_SEPARATOR)) {
    const key = known.find((k) => k === part);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}
