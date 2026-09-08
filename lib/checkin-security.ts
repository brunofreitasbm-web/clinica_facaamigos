import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * Defesas do endpoint público de check-in (app/api/checkin/route.ts). O
 * projeto não tem rate limiting em lugar nenhum e proíbe conceder execute a
 * `anon` (ver comentário em checkin_requests, 20260908040000) — a defesa
 * real do recurso é a confirmação humana da recepção (nada do fluxo anônimo
 * grava em `appointments`); o que vive aqui só eleva o custo de abuso e evita
 * que o endpoint sirva como oráculo para descobrir se alguém é paciente.
 */

const FORM_COOKIE_NAME = "ck_s";
const FORM_COOKIE_TTL_MS = 30 * 60 * 1000;

function hmacSecret(): string {
  const secret = process.env.CHECKIN_HMAC_SECRET;
  if (!secret) throw new Error("CHECKIN_HMAC_SECRET não configurada");
  return secret;
}

/** Hash do IP para throttle durável e forense — nunca o IP em claro (LGPD). */
export function hashIp(ip: string): string {
  const salt = process.env.CHECKIN_IP_SALT ?? "";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}

/** IP do requisitante atrás de proxy/CDN — mesma extração usada em qualquer
 * runtime Node.js edge-less do Next; `x-forwarded-for` pode trazer uma
 * cadeia "cliente, proxy1, proxy2" — o primeiro é o mais próximo do cliente. */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Cookie de sessão de formulário: emitido quando a página pública carrega,
 * exigido no POST. Barra um script que faz POST direto no endpoint sem antes
 * ter carregado a página (não impede um humano decidido, mas elimina o abuso
 * trivial de "curl em loop").
 */
export function issueFormToken(qrToken: string, serviceDate: string): string {
  const nonce = randomUUID();
  const payload = `${qrToken}|${serviceDate}|${nonce}`;
  const signature = createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  return `${payload}|${signature}`;
}

export function verifyFormToken(cookieValue: string, qrToken: string, serviceDate: string): boolean {
  const parts = cookieValue.split("|");
  if (parts.length !== 4) return false;
  const [tokenPart, datePart, nonce, signature] = parts;
  if (tokenPart !== qrToken || datePart !== serviceDate) return false;
  const expected = createHmac("sha256", hmacSecret())
    .update(`${tokenPart}|${datePart}|${nonce}`)
    .digest("hex");
  return timingSafeEqualStrings(signature, expected);
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const FORM_COOKIE = { name: FORM_COOKIE_NAME, maxAgeSeconds: FORM_COOKIE_TTL_MS / 1000 };

/**
 * Throttle em memória por IP — best-effort: cada instância serverless tem o
 * seu próprio Map, então isto NÃO segura um ataque distribuído sozinho (por
 * isso o throttle durável por ip_hash em checkin_requests, consultado no
 * banco, é a camada que realmente conta). Serve para o caso comum de uma
 * instância recebendo repetição rápida do mesmo cliente.
 */
const memoryHits = new Map<string, { count: number; windowStart: number }>();
const MEMORY_WINDOW_MS = 10 * 60 * 1000;
const MEMORY_MAX_HITS = 8;

export function memoryThrottleExceeded(key: string): boolean {
  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || now - entry.windowStart > MEMORY_WINDOW_MS) {
    memoryHits.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MEMORY_MAX_HITS;
}

/** Nome válido para o formulário público: 2-40 chars, só letras (com
 * acentos)/espaço/hífen/apóstrofo. Sem zod, como o resto do projeto. */
export function isValidDeclaredName(value: string): boolean {
  return /^[a-zA-ZÀ-ÿ' -]{2,40}$/.test(value.trim());
}

/** Data ISO plausível para nascimento: entre 1900-01-01 e hoje. */
export function isValidBirthDate(value: string, todayIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= "1900-01-01" && value <= todayIso;
}

/** Janela de funcionamento do check-in — fora dela, recusa (F13/segurança). */
export function isWithinOperatingHours(hour: number): boolean {
  return hour >= 6 && hour < 21;
}
