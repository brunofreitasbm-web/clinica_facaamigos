// lib/ux-friction.ts
//
// Regras PURAS (sem React, sem banco) do monitor de fricção de uso. Usado pelo
// coletor do navegador (components/friction-tracker.tsx) e pela rota que grava
// (app/api/ux-events/route.ts), então o mesmo saneamento vale nos dois lados.
//
// PRIVACIDADE (dados de saúde, LGPD): o monitor nunca guarda o que o usuário
// digitou, nem nome de paciente. Só guarda: qual TELA (com ids trocados por
// ":id"), qual TIPO de sinal, um rótulo curto do botão clicado (com números
// longos e e-mails removidos) e contagens/tempos. Tudo que não está na lista
// branca abaixo é descartado no servidor, mesmo que o navegador mande.

export const UX_EVENT_TYPES = [
  "page_view", // resumo de uma passagem por uma tela (tempo, cliques, hesitação)
  "rage_click", // cliques repetidos no mesmo ponto: "isto não está respondendo"
  "dead_click", // clicou num botão/área que parece clicável e nada aconteceu
  "form_error", // o formulário barrou o envio (campo obrigatório/inválido)
  "ui_error", // o sistema mostrou erro (aviso vermelho ou tela de erro)
] as const;

export type UxEventType = (typeof UX_EVENT_TYPES)[number];

export interface UxEventRow {
  event_type: UxEventType;
  route: string;
  target: string | null;
  detail: Record<string, number | string>;
  /** Há quantos ms o evento aconteceu, no momento do envio (o servidor deriva o horário real). */
  ago_ms: number;
}

export const MAX_EVENTS_PER_BATCH = 30;
export const MAX_BODY_BYTES = 20_000;

/** Chaves numéricas aceitas em `detail` (o resto é descartado). */
const NUMERIC_DETAIL_KEYS = ["dwell_ms", "clicks", "ttfa_ms", "disabled"] as const;
/** Chaves de texto aceitas em `detail`. */
const TEXT_DETAIL_KEYS = ["field", "kind"] as const;

const MAX_MS = 6 * 60 * 60 * 1000; // 6h: acima disso é aba esquecida aberta
const MAX_AGO_MS = 60 * 60 * 1000; // lote parado há mais de 1h: horário deixa de ser confiável
const MAX_COUNT = 10_000; // teto de `clicks`

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "/recepcao/pacientes/6f1c…-uuid/editar?x=1" → "/recepcao/pacientes/:id/editar".
 * Tira query/hash e troca segmentos que parecem identificador (uuid, número,
 * token longo) por ":id", para que a mesma tela vire uma linha só no relatório.
 */
export function normalizeRoute(input: string): string {
  const path = String(input ?? "").split(/[?#]/)[0] || "/";
  const segments = path
    .split("/")
    .filter((_, i) => i === 0 || _ !== "")
    .map((seg) => {
      if (!seg) return seg;
      if (UUID_RE.test(seg)) return ":id";
      if (/^\d+$/.test(seg)) return ":id";
      // Token/slug com dígito misturado e comprimento de identificador.
      if (seg.length >= 12 && /\d/.test(seg) && /[a-z]/i.test(seg)) return ":id";
      return seg;
    });
  const out = segments.join("/") || "/";
  return out.startsWith("/") ? out.slice(0, 120) : `/${out}`.slice(0, 120);
}

/**
 * Rótulo curto e seguro de um botão/link. Remove e-mail, sequências de 4+
 * dígitos (CPF, telefone, protocolo) e corta em 40 caracteres. Devolve null se
 * não sobrar nada útil.
 */
export function scrubLabel(input: unknown, max = 40): string | null {
  if (typeof input !== "string") return null;
  let text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.includes("@")) return null;
  text = text.replace(/\d[\d.\-/() ]{2,}\d/g, "…").replace(/\d{4,}/g, "…");
  text = text.slice(0, max).trim();
  return text || null;
}

function clampNumber(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), max);
}

export function sanitizeDetail(raw: unknown): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of NUMERIC_DETAIL_KEYS) {
    const n = clampNumber(src[key], key.endsWith("_ms") ? MAX_MS : MAX_COUNT);
    if (n !== null) out[key] = n;
  }
  for (const key of TEXT_DETAIL_KEYS) {
    const s = scrubLabel(src[key]);
    if (s) out[key] = s;
  }
  return out;
}

/**
 * Valida e limpa um lote vindo do navegador. Nunca lança: evento inválido é
 * simplesmente ignorado (um cliente com bug não pode derrubar a rota).
 */
export function sanitizeBatch(body: unknown): UxEventRow[] {
  if (!body || typeof body !== "object") return [];
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];

  const rows: UxEventRow[] = [];
  for (const raw of events.slice(0, MAX_EVENTS_PER_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (!(UX_EVENT_TYPES as readonly string[]).includes(e.type as string)) continue;
    if (typeof e.route !== "string" || !e.route.startsWith("/")) continue;
    rows.push({
      event_type: e.type as UxEventType,
      route: normalizeRoute(e.route),
      target: scrubLabel(e.target),
      detail: sanitizeDetail(e.detail),
      ago_ms: clampNumber(e.agoMs, MAX_AGO_MS) ?? 0,
    });
  }
  return rows;
}

/** Id de sessão (por aba) vindo do navegador: só uuid/hex curto, senão descarta. */
export function sanitizeSessionId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  return /^[A-Za-z0-9-]{8,64}$/.test(input) ? input : null;
}

/**
 * Detector de "rage click": `threshold` cliques em até `windowMs`, todos dentro
 * de `radiusPx` do primeiro. Depois de disparar, exige uma pausa (`cooldownMs`)
 * para não gerar 20 eventos de um mesmo surto de irritação.
 */
export class RageClickDetector {
  private clicks: { t: number; x: number; y: number }[] = [];
  private lastFiredAt = -Infinity;

  private readonly threshold: number;
  private readonly windowMs: number;
  private readonly radiusPx: number;
  private readonly cooldownMs: number;

  constructor(threshold = 3, windowMs = 1000, radiusPx = 40, cooldownMs = 3000) {
    this.threshold = threshold;
    this.windowMs = windowMs;
    this.radiusPx = radiusPx;
    this.cooldownMs = cooldownMs;
  }

  /** Registra um clique; devolve true se ele completa um surto. */
  record(t: number, x: number, y: number): boolean {
    this.clicks = this.clicks.filter((c) => t - c.t <= this.windowMs);
    this.clicks.push({ t, x, y });
    const first = this.clicks[0];
    const near = this.clicks.filter((c) => Math.hypot(c.x - first.x, c.y - first.y) <= this.radiusPx);
    if (near.length >= this.threshold && t - this.lastFiredAt > this.cooldownMs) {
      this.lastFiredAt = t;
      this.clicks = [];
      return true;
    }
    return false;
  }
}
