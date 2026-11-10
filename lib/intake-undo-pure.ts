// lib/intake-undo-pure.ts
// "Desfazer" das ações da Fila de entrada: guarda o estado de antes e restaura exatamente esses
// valores, só se o caso ainda estiver como a ação o deixou (compare-and-set). PURO, sem import `@/`.
//
// Cada tipo de ação tem:
//   - RESTORE: colunas que voltam ao valor de antes da ação;
//   - EXPECT: colunas que precisam estar iguais ao que se leu logo depois da ação. Se alguém mexeu
//     no caso nesse meio tempo, nada é desfeito.
// O desfazer é um update direto das colunas guardadas e nunca chama as ações de origem.

// Só ações que NÃO mandam WhatsApp têm desfazer: uma mensagem enviada não se recolhe.
export type UndoKind = "guide_sent" | "waive" | "plan_denied" | "plan_more_docs";

export type DraftStateRow = {
  guide_sent_at: string | null;
  guide_sent_by: string | null;
  plan_authorized_at: string | null;
  plan_authorized_by: string | null;
  authorization_waived: boolean;
  authorized_guide: unknown;
  authorization_id: string | null;
  scheduling_enabled_at: string | null;
  scheduling_enabled_by: string | null;
  returned_to_reception_at: string | null;
  returned_to_reception_by: string | null;
  returned_to_reception_reason: string | null;
  plan_denied_at: string | null;
  plan_denied_by: string | null;
  plan_more_docs_at: string | null;
  plan_more_docs_by: string | null;
};

export type DraftColumn = keyof DraftStateRow;

/** Colunas lidas para montar e conferir o desfazer (select do servidor). */
export const DRAFT_STATE_COLUMNS: DraftColumn[] = [
  "guide_sent_at",
  "guide_sent_by",
  "plan_authorized_at",
  "plan_authorized_by",
  "authorization_waived",
  "authorized_guide",
  "authorization_id",
  "scheduling_enabled_at",
  "scheduling_enabled_by",
  "returned_to_reception_at",
  "returned_to_reception_by",
  "returned_to_reception_reason",
  "plan_denied_at",
  "plan_denied_by",
  "plan_more_docs_at",
  "plan_more_docs_by",
];

export const RESTORE_COLUMNS: Record<UndoKind, DraftColumn[]> = {
  guide_sent: ["guide_sent_at", "guide_sent_by"],
  waive: ["authorization_waived", "plan_authorized_at", "plan_authorized_by", "authorized_guide"],
  plan_denied: ["plan_denied_at", "plan_denied_by", "guide_sent_at", "guide_sent_by"],
  plan_more_docs: ["plan_more_docs_at", "plan_more_docs_by", "guide_sent_at", "guide_sent_by"],
};

export const EXPECT_COLUMNS: Record<UndoKind, DraftColumn[]> = {
  guide_sent: ["guide_sent_at", "plan_authorized_at", "authorization_waived", "scheduling_enabled_at", "plan_denied_at", "plan_more_docs_at"],
  waive: ["authorization_waived", "plan_authorized_at", "authorization_id", "scheduling_enabled_at"],
  plan_denied: ["plan_denied_at", "guide_sent_at", "plan_authorized_at", "authorization_waived", "scheduling_enabled_at"],
  plan_more_docs: ["plan_more_docs_at", "guide_sent_at", "plan_authorized_at", "authorization_waived", "scheduling_enabled_at"],
};

/** Só a promoção automática "interessado/aguardando" para "avaliacao" (promoteToPatient) é desfeita. */
export const PROMOTABLE_STATUSES = ["interessado", "aguardando"];
export const PROMOTED_STATUS = "avaliacao";

export type PatientUndo = { id: string; previous: string; applied: string };

export type UndoToken = {
  kind: UndoKind;
  previous: Partial<DraftStateRow>;
  applied: Partial<DraftStateRow>;
  /** Presente só quando a ação promoveu o paciente (status de antes e de depois). */
  patient: PatientUndo | null;
};

type Kind = "ts" | "uuid" | "bool" | "text" | "json";
const COLUMN_TYPE: Record<DraftColumn, Kind> = {
  guide_sent_at: "ts",
  guide_sent_by: "uuid",
  plan_authorized_at: "ts",
  plan_authorized_by: "uuid",
  authorization_waived: "bool",
  authorized_guide: "json",
  authorization_id: "uuid",
  scheduling_enabled_at: "ts",
  scheduling_enabled_by: "uuid",
  returned_to_reception_at: "ts",
  returned_to_reception_by: "uuid",
  returned_to_reception_reason: "text",
  plan_denied_at: "ts",
  plan_denied_by: "uuid",
  plan_more_docs_at: "ts",
  plan_more_docs_by: "uuid",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validValue(col: DraftColumn, v: unknown): boolean {
  if (v === null) return COLUMN_TYPE[col] !== "bool";
  switch (COLUMN_TYPE[col]) {
    case "ts":
      return typeof v === "string" && !Number.isNaN(Date.parse(v));
    case "uuid":
      return typeof v === "string" && UUID.test(v);
    case "bool":
      return typeof v === "boolean";
    case "text":
      return typeof v === "string" && v.length <= 4000;
    case "json":
      return typeof v === "object" && !Array.isArray(v);
  }
}

/** Mesmo valor? Datas comparadas pelo instante (o banco pode devolver outro formato); JSON pelo conteúdo. */
export function sameValue(col: DraftColumn, a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (COLUMN_TYPE[col] === "ts") {
    const ta = Date.parse(String(a));
    const tb = Date.parse(String(b));
    if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
    return ta === tb;
  }
  if (COLUMN_TYPE[col] === "json") return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function pick(row: DraftStateRow, cols: DraftColumn[]): Partial<DraftStateRow> {
  const out: Partial<DraftStateRow> = {};
  for (const c of cols) (out as Record<string, unknown>)[c] = row[c] ?? null;
  return out;
}

/**
 * Monta o desfazer a partir do estado lido antes e depois da ação. Devolve null quando não há o
 * que desfazer: nada mudou nas colunas restauráveis.
 */
export function buildUndoToken(
  kind: UndoKind,
  before: DraftStateRow,
  after: DraftStateRow,
  patient?: { id: string; before: string | null; after: string | null } | null,
): UndoToken | null {
  const restore = RESTORE_COLUMNS[kind];
  if (restore.every((c) => sameValue(c, before[c], after[c]))) return null;
  const promoted =
    patient && patient.before && patient.after && patient.before !== patient.after && PROMOTABLE_STATUSES.includes(patient.before) && patient.after === PROMOTED_STATUS
      ? { id: patient.id, previous: patient.before, applied: patient.after }
      : null;
  return { kind, previous: pick(before, restore), applied: pick(after, EXPECT_COLUMNS[kind]), patient: promoted };
}

/** Confere o formato do desfazer que veio do navegador; só colunas permitidas para o tipo. */
export function validateUndoToken(raw: unknown): UndoToken | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const kind = t.kind;
  if (kind !== "guide_sent" && kind !== "waive" && kind !== "plan_denied" && kind !== "plan_more_docs") return null;
  const check = (obj: unknown, cols: DraftColumn[]): Partial<DraftStateRow> | null => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const rec = obj as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length !== cols.length || !cols.every((c) => keys.includes(c))) return null;
    for (const c of cols) if (!validValue(c, rec[c])) return null;
    return rec as Partial<DraftStateRow>;
  };
  const previous = check(t.previous, RESTORE_COLUMNS[kind]);
  const applied = check(t.applied, EXPECT_COLUMNS[kind]);
  if (!previous || !applied) return null;
  let patient: PatientUndo | null = null;
  if (t.patient !== null && t.patient !== undefined) {
    const p = t.patient as Record<string, unknown>;
    if (
      typeof p.id !== "string" ||
      !UUID.test(p.id) ||
      typeof p.previous !== "string" ||
      !PROMOTABLE_STATUSES.includes(p.previous) ||
      p.applied !== PROMOTED_STATUS
    ) {
      return null;
    }
    patient = { id: p.id, previous: p.previous, applied: p.applied };
  }
  return { kind, previous, applied, patient };
}

export type RestoreDecision = { ok: true; update: Partial<DraftStateRow> } | { ok: false; reason: "changed" };

/** Compare-and-set: só restaura se as colunas EXPECT ainda estão como a ação deixou. */
export function decideRestore(token: UndoToken, current: DraftStateRow): RestoreDecision {
  for (const c of EXPECT_COLUMNS[token.kind]) {
    if (!sameValue(c, current[c], token.applied[c])) return { ok: false, reason: "changed" };
  }
  return { ok: true, update: { ...token.previous } };
}

/** O status do paciente volta só se ainda é o que a promoção gravou. */
export function shouldRestorePatient(token: UndoToken, currentStatus: string | null): boolean {
  return Boolean(token.patient && currentStatus === token.patient.applied);
}
