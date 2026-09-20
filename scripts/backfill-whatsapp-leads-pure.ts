// scripts/backfill-whatsapp-leads-pure.ts
// Lógica PURA do backfill (scripts/backfill-whatsapp-leads.ts): interpretar o
// nome dos objetos legados do bucket público `patient-documents`, converter a
// URL pública em caminho de objeto e montar o ponteiro `storage://` do bucket
// privado. Sem nenhum import (nem alias `@/`) para rodar em
// `node --experimental-strip-types --test` (tests/backfill-whatsapp-leads.test.ts).

export const LEGACY_BUCKET = "patient-documents";
export const PRIVATE_BUCKET = "clinic-documents";
export const LEGACY_FOLDER = "anamnese-laudos-guias";

export type LegacyKind = "laudo" | "guia" | "carteirinha";
export type LegacySlot = "laudo" | "guia" | "carteirinha_frente" | "carteirinha_verso";

export type LegacyObjectName = {
  path: string;
  epochMs: number;
  slot: LegacySlot;
  kind: LegacyKind;
  /** Telefone em E.164 com "+" (o nome do objeto grava assim). */
  phone: string;
  ext: string;
};

/**
 * `anamnese-laudos-guias/<epochms>_<laudo|guia|carteirinha_frente|carteirinha_verso>_<+telefone>.<ext>`
 * (a extensão é sempre "pdf" no legado, mesmo quando o conteúdo é JPEG — quem
 * decide o tipo real é sniffFileType). Devolve null se o nome não segue o padrão.
 */
export function parseLegacyObjectName(path: string): LegacyObjectName | null {
  const match = /^(?:.*\/)?(\d{10,})_(laudo|guia|carteirinha_frente|carteirinha_verso)_\+?(\d{8,15})\.([A-Za-z0-9]{1,5})$/.exec(path);
  if (!match) return null;
  const slot = match[2] as LegacySlot;
  return {
    path,
    epochMs: Number(match[1]),
    slot,
    kind: slotToKind(slot),
    phone: `+${match[3]}`,
    ext: match[4].toLowerCase(),
  };
}

export function slotToKind(slot: LegacySlot): LegacyKind {
  return slot === "laudo" ? "laudo" : slot === "guia" ? "guia" : "carteirinha";
}

/** Chaves de `chatbot_sessions.collected_data` que guardam URL de arquivo → slot. */
export const SESSION_URL_KEYS: Record<string, LegacySlot> = {
  laudo_pdf_url: "laudo",
  guia_pdf_url: "guia",
  carteirinha_frente_url: "carteirinha_frente",
  carteirinha_verso_url: "carteirinha_verso",
};

/** Colunas de `anamnesis_scheduling_requests` com URL de arquivo → slot. */
export const REQUEST_URL_COLUMNS: Record<string, LegacySlot> = {
  laudo_pdf_url: "laudo",
  guia_pdf_url: "guia",
  carteirinha_frente_url: "carteirinha_frente",
  carteirinha_verso_url: "carteirinha_verso",
};

/**
 * Caminho do objeto (dentro do bucket) de uma URL PÚBLICA do bucket legado
 * `patient-documents`
 * (`https://<proj>.supabase.co/storage/v1/object/public/patient-documents/<path>`).
 * Devolve null para qualquer outra coisa: ponteiro `storage://` já migrado,
 * URL do Twilio, outro bucket, path com `..`, vazio.
 */
export function legacyUrlToPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const prefix = `/storage/v1/object/public/${LEGACY_BUCKET}/`;
  const at = url.pathname.indexOf(prefix);
  if (at === -1) return null;
  const rawPath = url.pathname.slice(at + prefix.length);
  const parts: string[] = [];
  for (const part of rawPath.split("/")) {
    let decoded: string;
    try {
      // `+` num path NÃO é espaço: decodeURIComponent (e não URLSearchParams) preserva.
      decoded = decodeURIComponent(part);
    } catch {
      return null;
    }
    if (decoded === "" || decoded === "." || decoded === "..") return null;
    parts.push(decoded);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

/** `storage://clinic-documents/<path>` — formato lido por lib/file-access.ts (/api/arquivos/*). */
export function toStoragePointer(path: string, bucket: string = PRIVATE_BUCKET): string {
  return `storage://${bucket}/${path.replace(/^\/+/, "")}`;
}

/** Inverso de toStoragePointer; null se não for um ponteiro `storage://`. */
export function parseStoragePointer(value: string | null | undefined): { bucket: string; path: string } | null {
  if (!value) return null;
  const match = /^storage:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  return match ? { bucket: match[1], path: match[2] } : null;
}

/** Chave estável de dedupe em `documents.source_key`. */
export function legacySourceKey(objectPath: string): string {
  return `legacy:${objectPath}`;
}

export type SessionFileSlot = { key: string; slot: LegacySlot; kind: LegacyKind; url: string; path: string };

/** Arquivos do bucket legado ainda referenciados por URL num `collected_data` (ou linha de requisição). */
export function legacySlotsFromRecord(record: Record<string, unknown> | null | undefined, keys: Record<string, LegacySlot> = SESSION_URL_KEYS): SessionFileSlot[] {
  const out: SessionFileSlot[] = [];
  for (const [key, slot] of Object.entries(keys)) {
    const url = record?.[key];
    if (typeof url !== "string") continue;
    const path = legacyUrlToPath(url);
    if (path) out.push({ key, slot, kind: slotToKind(slot), url, path });
  }
  return out;
}

/** CPF nunca sai completo nos relatórios: `***.***.***-12`. */
export function maskCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3) return "***";
  return `***.***.***-${digits.slice(-2)}`;
}

/** Telefone → só os dígitos, sem DDI, sem o "9" opcional do celular (mesma regra de lib/twilio.ts). */
export function normalizeBrLocalPhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return digits.slice(0, 2) + digits.slice(3);
  return digits;
}

/** Fica só com os args conhecidos; `--apply` vence, o padrão é dry-run. */
export function parseArgs(argv: string[]): {
  apply: boolean;
  skipDrafts: boolean;
  includeExtractedDrafts: boolean;
  enrich: boolean;
  unknown: string[];
} {
  const known = new Set(["--apply", "--dry-run", "--skip-drafts", "--include-extracted-drafts", "--enrich"]);
  const unknown = argv.filter((a) => !known.has(a));
  return {
    apply: argv.includes("--apply") && !argv.includes("--dry-run"),
    skipDrafts: argv.includes("--skip-drafts"),
    includeExtractedDrafts: argv.includes("--include-extracted-drafts"),
    enrich: argv.includes("--enrich"),
    unknown,
  };
}
