// scripts/backfill-whatsapp-leads.mts
//
// BACKFILL do "cadastro automático de lead a partir de documentos enviados por
// WhatsApp" (lib/whatsapp-lead.ts). Recupera o que os responsáveis JÁ mandaram
// antes desse sistema existir e que hoje está "perdido": objetos do bucket
// público `patient-documents` (anamnese-laudos-guias/), URLs em
// `chatbot_sessions.collected_data` / `anamnesis_scheduling_requests` e
// rascunhos `registration_drafts` nunca processados. Cada um vira lead
// visível: paciente `interessado` + responsável + linhas em `documents`
// (arquivo no bucket PRIVADO `clinic-documents`).
//
// COMO RODAR (na raiz do projeto; não há tsx — usa o type-stripping do Node e
// um loader que resolve o alias `@/`):
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --import ./scripts/register-alias.mjs scripts/backfill-whatsapp-leads.mts            # dry-run (padrão)
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --import ./scripts/register-alias.mjs scripts/backfill-whatsapp-leads.mts --apply    # executa de verdade
// Flags: --dry-run (padrão; vence --apply se vierem os dois), --apply,
//   --skip-drafts (não toca em registration_drafts / não chama o Gemini),
//   --include-extracted-drafts (também promove rascunhos já 'extracted' sem paciente),
//   --enrich (após anexar, lê os documentos do lead com o Gemini — opt-in).
// Lê .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY).
// Relatório JSON: $BACKFILL_REPORT_PATH ou o scratchpad da sessão.
//
// Garantias: IDEMPOTENTE (dedupe por documents.source_key = `legacy:<objeto>`;
// ponteiros já reescritos para `storage://` não são reprocessados); NUNCA apaga
// objeto do bucket legado; NUNCA cria paciente sem nome+nascimento; NUNCA toca
// em requisição rejeitada/cancelada; nunca imprime CPF completo nem chaves.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { formatE164Phone } from "@/lib/twilio";
import { ALLOWED_MIME_TYPES } from "@/lib/registration-drafts-ingest";
import { claimAndProcessDrafts } from "@/lib/registration-drafts-process";
import { attachLeadDocument, enrichLeadFromDocuments, promoteDraftToLead, upsertWhatsappLead } from "@/lib/whatsapp-lead";
import {
  isLeadIdentityComplete,
  normalizeBirthDate,
  normalizeFullName,
  pickLeadCandidate,
  sniffFileType,
  type LeadCandidate,
} from "@/lib/whatsapp-lead-pure";
import {
  LEGACY_BUCKET,
  LEGACY_FOLDER,
  REQUEST_URL_COLUMNS,
  legacySlotsFromRecord,
  legacySourceKey,
  maskCpf,
  normalizeBrLocalPhone,
  parseArgs,
  parseLegacyObjectName,
  toStoragePointer,
  type LegacyKind,
  type SessionFileSlot,
} from "./backfill-whatsapp-leads-pure";

// ---------------------------------------------------------------------
// Ambiente / argumentos
// ---------------------------------------------------------------------

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const REPORT_PATH =
  process.env.BACKFILL_REPORT_PATH ??
  "C:\\Users\\bruno\\AppData\\Local\\Temp\\claude\\c--Users-bruno-Documents-Projetos-Clinica-Fa-a-Amigos\\e870cb9b-bcf8-4560-a083-5f265a0e5b8c\\scratchpad\\backfill-report.json";

const ACTIVE_REQUEST_STATUSES = new Set(["pendente_supervisor", "aprovado", "agendado"]);

// ---------------------------------------------------------------------
// Tipos do relatório
// ---------------------------------------------------------------------

type Row = Record<string, unknown>;
type Loose = SupabaseClient;

type DocOutcome = "attached" | "already_attached" | "would_attach" | "failed";
type DocEntry = {
  objectPath: string;
  kind: string;
  outcome: DocOutcome;
  detectedMime?: string;
  sizeBytes?: number;
  storagePath?: string;
  detail?: string;
};

type LeadEntry = {
  patientId: string | null; // null enquanto for só simulação de criação (dry-run)
  action: "created" | "existing" | "would_create";
  child: string | null;
  childBirthDate: string | null;
  guardian: string | null;
  guardianCpf: string | null; // sempre mascarado
  phone: string;
  sources: string[];
  documents: DocEntry[];
  documentsAttached: number;
};

type NotMigrated = { type: "storage_object" | "request" | "session" | "draft"; ref: string; phone: string | null; reason: string };
type Change = { table: string; key: string; description: string; applied: boolean };
type DraftEntry = { draftId: string; phone: string | null; status: string; files: number; outcome: string; patientId?: string | null; error?: string };

const leads = new Map<string, LeadEntry>();
const notMigrated: NotMigrated[] = [];
const changes: Change[] = [];
const draftEntries: DraftEntry[] = [];
const errors: string[] = [];

// Estado do run (entre etapas).
const handledPaths = new Set<string>(); // objetos já tratados (anexados ou reportados) em 1/2
const attachedByPath = new Map<string, { patientId: string; storagePath: string }>();
const downloads = new Map<string, Uint8Array | null>();
let virtualSeq = 0;
const virtualCandidates = new Map<string, LeadCandidate[]>(); // dry-run: leads que SERIAM criados, por telefone local

const args = parseArgs(process.argv.slice(2));
const APPLY = args.apply;

function log(message: string): void {
  console.log(message);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

// ---------------------------------------------------------------------
// Leitura: candidatos por telefone (mesma regra de lib/whatsapp-lead.ts, só leitura)
// ---------------------------------------------------------------------

async function findCandidatesByPhone(db: Loose, phone: string): Promise<{ candidates: LeadCandidate[]; guardianNames: Map<string, string> }> {
  const empty = { candidates: [] as LeadCandidate[], guardianNames: new Map<string, string>() };
  const last8 = phone.replace(/\D/g, "").slice(-8);
  if (last8.length < 8) return empty;
  const hyphenated = `${last8.slice(0, 4)}-${last8.slice(4)}`;
  const { data: guardians } = await db.from("guardians").select("id, patient_id, full_name, phone").or(`phone.ilike.%${last8},phone.ilike.%${hyphenated}`);
  const target = normalizeBrLocalPhone(phone);
  const matching = ((guardians ?? []) as Row[]).filter((g) => normalizeBrLocalPhone(String(g.phone ?? "")) === target);
  if (matching.length === 0) return empty;
  const patientIds = [...new Set(matching.map((g) => String(g.patient_id)))];
  const { data: patients } = await db.from("patients").select("id, full_name, birth_date, status, created_at").eq("clinic_id", DEV_CLINIC_ID).in("id", patientIds);
  const guardianNames = new Map<string, string>();
  for (const g of matching) if (!guardianNames.has(String(g.patient_id))) guardianNames.set(String(g.patient_id), String(g.full_name ?? ""));
  const candidates: LeadCandidate[] = ((patients ?? []) as Row[]).map((p) => ({
    patientId: String(p.id),
    fullName: String(p.full_name),
    birthDate: String(p.birth_date),
    status: String(p.status),
    createdAt: String(p.created_at),
  }));
  return { candidates, guardianNames };
}

// ---------------------------------------------------------------------
// Resolução do lead (cria de verdade só em --apply)
// ---------------------------------------------------------------------

type LeadIdentityInput = {
  phone: string;
  childName?: string | null;
  childBirthDate?: string | null;
  guardianName?: string | null;
  guardianCpf?: string | null;
};

type ResolvedLead = { patientId: string; entry: LeadEntry; virtual: boolean };

function registerEntry(patientId: string, base: Omit<LeadEntry, "sources" | "documents" | "documentsAttached">, source: string): LeadEntry {
  let entry = leads.get(patientId);
  if (!entry) {
    entry = { ...base, sources: [], documents: [], documentsAttached: 0 };
    leads.set(patientId, entry);
  }
  if (!entry.sources.includes(source)) entry.sources.push(source);
  return entry;
}

async function describeExisting(db: Loose, patientId: string): Promise<{ child: string | null; birth: string | null; guardian: string | null; cpf: string | null }> {
  const { data: patient } = await db.from("patients").select("full_name, birth_date").eq("id", patientId).maybeSingle();
  const { data: guardian } = await db.from("guardians").select("full_name, cpf").eq("patient_id", patientId).order("is_emergency_contact", { ascending: false }).limit(1).maybeSingle();
  return {
    child: str(asRecord(patient).full_name),
    birth: str(asRecord(patient).birth_date),
    guardian: str(asRecord(guardian).full_name),
    cpf: maskCpf(str(asRecord(guardian).cpf)),
  };
}

async function resolveLead(db: Loose, identity: LeadIdentityInput, source: string): Promise<ResolvedLead | null> {
  const phone = formatE164Phone((identity.phone ?? "").replace("whatsapp:", ""));
  if (!phone) return null;
  const local = normalizeBrLocalPhone(phone);
  const base = {
    child: normalizeFullName(identity.childName),
    childBirthDate: normalizeBirthDate(identity.childBirthDate),
    guardian: normalizeFullName(identity.guardianName),
    guardianCpf: maskCpf(identity.guardianCpf),
    phone,
  };

  if (APPLY) {
    const result = await upsertWhatsappLead({ ...identity, phone });
    if (!result) return null;
    let entry = leads.get(result.patientId);
    if (!entry) {
      if (result.created) {
        entry = registerEntry(result.patientId, { ...base, patientId: result.patientId, action: "created" }, source);
      } else {
        const d = await describeExisting(db, result.patientId);
        entry = registerEntry(result.patientId, { patientId: result.patientId, action: "existing", child: d.child, childBirthDate: d.birth, guardian: d.guardian, guardianCpf: d.cpf, phone }, source);
      }
    } else if (!entry.sources.includes(source)) entry.sources.push(source);
    return { patientId: result.patientId, entry, virtual: false };
  }

  // Dry-run: mesma decisão do upsert, sem escrever. Leads "criados" pelo próprio
  // dry-run entram como candidatos virtuais para as etapas seguintes enxergarem.
  const found = await findCandidatesByPhone(db, phone);
  const all = [...found.candidates, ...(virtualCandidates.get(local) ?? [])];
  const picked = pickLeadCandidate(all, { childName: identity.childName, childBirthDate: identity.childBirthDate });
  if (picked) {
    const known = leads.get(picked.patientId);
    if (known) {
      if (!known.sources.includes(source)) known.sources.push(source);
      return { patientId: picked.patientId, entry: known, virtual: picked.patientId.startsWith("dry:") };
    }
    const d = await describeExisting(db, picked.patientId);
    const entry = registerEntry(picked.patientId, { patientId: picked.patientId, action: "existing", child: d.child, childBirthDate: d.birth, guardian: d.guardian, guardianCpf: d.cpf, phone }, source);
    return { patientId: picked.patientId, entry, virtual: false };
  }
  if (!isLeadIdentityComplete({ childName: identity.childName, childBirthDate: identity.childBirthDate })) return null;
  const virtualId = `dry:${++virtualSeq}`;
  const list = virtualCandidates.get(local) ?? [];
  list.push({ patientId: virtualId, fullName: base.child ?? "", birthDate: base.childBirthDate ?? "", status: "interessado", createdAt: new Date().toISOString() });
  virtualCandidates.set(local, list);
  const entry = registerEntry(virtualId, { ...base, patientId: null, action: "would_create" }, source);
  return { patientId: virtualId, entry, virtual: true };
}

// ---------------------------------------------------------------------
// Anexar um objeto legado ao lead
// ---------------------------------------------------------------------

async function downloadLegacy(admin: ReturnType<typeof createAdminClient>, objectPath: string): Promise<Uint8Array | null> {
  if (downloads.has(objectPath)) return downloads.get(objectPath) ?? null;
  const { data, error } = await admin.storage.from(LEGACY_BUCKET).download(objectPath);
  let buffer: Uint8Array | null = null;
  if (data && !error) buffer = new Uint8Array(await data.arrayBuffer());
  else errors.push(`download ${objectPath}: ${error?.message ?? "sem dados"}`);
  downloads.set(objectPath, buffer);
  return buffer;
}

async function attachLegacy(
  admin: ReturnType<typeof createAdminClient>,
  db: Loose,
  lead: ResolvedLead,
  phone: string,
  slot: { path: string; kind: LegacyKind },
): Promise<DocEntry> {
  const doc: DocEntry = { objectPath: slot.path, kind: slot.kind, outcome: "failed" };
  const done = (d: DocEntry) => {
    lead.entry.documents.push(d);
    if (d.outcome === "attached" || d.outcome === "would_attach") lead.entry.documentsAttached++;
    return d;
  };

  const cached = attachedByPath.get(slot.path);
  if (cached && cached.patientId === lead.patientId) return done({ ...doc, outcome: "already_attached", storagePath: cached.storagePath, detail: "já tratado antes neste run" });

  const buffer = await downloadLegacy(admin, slot.path);
  if (!buffer) return done({ ...doc, detail: "objeto ausente ou ilegível no bucket legado" });
  doc.sizeBytes = buffer.byteLength;
  const sniffed = sniffFileType(buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.has(sniffed.mime)) return done({ ...doc, detail: "formato não suportado (magic bytes)" });
  doc.detectedMime = sniffed.mime;

  const sourceKey = legacySourceKey(slot.path);
  const originalName = slot.path.split("/").pop() ?? slot.kind;

  if (!APPLY) {
    if (!lead.virtual) {
      const { data } = await db.from("documents").select("id, storage_path").eq("patient_id", lead.patientId).eq("source_key", sourceKey).maybeSingle();
      if (data) return done({ ...doc, outcome: "already_attached", storagePath: str(asRecord(data).storage_path) ?? undefined, detail: "já existe em documents" });
    }
    const placeholder = `leads/${phone.replace(/\D/g, "")}/<novo>`;
    attachedByPath.set(slot.path, { patientId: lead.patientId, storagePath: placeholder });
    return done({ ...doc, outcome: "would_attach", storagePath: placeholder });
  }

  const result = await attachLeadDocument({
    patientId: lead.patientId,
    phone,
    buffer,
    kind: slot.kind,
    sourceKey,
    originalName,
    contentTypeHint: "application/pdf", // o legado rotulava tudo como PDF; o conteúdo real vence
  });
  if (!result.ok) return done({ ...doc, detail: result.error });
  attachedByPath.set(slot.path, { patientId: lead.patientId, storagePath: result.storagePath });
  return done({ ...doc, outcome: result.duplicate ? "already_attached" : "attached", storagePath: result.storagePath, detectedMime: result.mime });
}

function isOk(d: DocEntry): boolean {
  return d.outcome === "attached" || d.outcome === "already_attached";
}

// ---------------------------------------------------------------------
// Etapa 1: requisições de anamnese
// ---------------------------------------------------------------------

async function stepRequests(admin: ReturnType<typeof createAdminClient>, db: Loose, sessions: Row[]): Promise<void> {
  log("\n[1/5] Requisições de anamnese (pendente_supervisor / aprovado / agendado)");
  const { data } = await db.from("anamnesis_scheduling_requests").select("*").order("created_at", { ascending: true });
  for (const req of (data ?? []) as Row[]) {
    const id = String(req.id);
    const status = String(req.status);
    const phone = str(req.guardian_phone);
    const slots = legacySlotsFromRecord(req, REQUEST_URL_COLUMNS);

    if (!ACTIVE_REQUEST_STATUSES.has(status)) {
      for (const s of slots) {
        handledPaths.add(s.path);
        notMigrated.push({ type: "storage_object", ref: `${LEGACY_BUCKET}/${s.path}`, phone, reason: `requisição com status "${status}" (rejeitada/cancelada: não tocar)` });
      }
      continue;
    }
    if (slots.length === 0 || !phone) continue;

    // Nascimento vem da sessão do bot (a requisição não guarda).
    const local = normalizeBrLocalPhone(phone);
    const reqChild = normalizeFullName(str(req.child_name))?.toLowerCase();
    const session =
      sessions.find((s) => asRecord(s.collected_data).request_id === id) ??
      sessions.find((s) => normalizeBrLocalPhone(String(s.phone_number)) === local && normalizeFullName(str(asRecord(s.collected_data).child_name))?.toLowerCase() === reqChild);
    const birth = str(asRecord(session?.collected_data).child_birth_date);

    let lead: ResolvedLead | null = null;
    const existingPatientId = str(req.patient_id);
    if (existingPatientId) {
      const { data: p } = await db.from("patients").select("id").eq("id", existingPatientId).maybeSingle();
      if (p) {
        const known = leads.get(existingPatientId);
        const d = known ? null : await describeExisting(db, existingPatientId);
        const entry = known ?? registerEntry(existingPatientId, { patientId: existingPatientId, action: "existing", child: d?.child ?? null, childBirthDate: d?.birth ?? null, guardian: d?.guardian ?? null, guardianCpf: d?.cpf ?? null, phone }, `request:${id}`);
        if (!entry.sources.includes(`request:${id}`)) entry.sources.push(`request:${id}`);
        lead = { patientId: existingPatientId, entry, virtual: false };
      }
    }
    if (!lead) {
      lead = await resolveLead(db, { phone, childName: str(req.child_name), childBirthDate: birth, guardianName: str(req.guardian_name), guardianCpf: str(req.guardian_cpf) }, `request:${id}`);
    }
    if (!lead) {
      for (const s of slots) {
        handledPaths.add(s.path);
        notMigrated.push({ type: "request", ref: `request:${id}/${s.key}`, phone, reason: "identidade insuficiente (sem nascimento da criança e sem paciente para o telefone)" });
      }
      continue;
    }

    const patch: Record<string, string> = {};
    for (const s of slots) {
      handledPaths.add(s.path);
      const doc = await attachLegacy(admin, db, lead, phone, s);
      if (doc.storagePath && (isOk(doc) || doc.outcome === "would_attach")) patch[s.key] = toStoragePointer(doc.storagePath);
      else notMigrated.push({ type: "request", ref: `request:${id}/${s.key}`, phone, reason: doc.detail ?? "falha ao anexar" });
    }

    const canSetPatient = !req.patient_id && status !== "agendado" && !lead.virtual;
    const willSetPatient = !req.patient_id && status !== "agendado";
    const cols = Object.keys(patch);
    if (cols.length === 0 && !willSetPatient) continue;
    const description = `${cols.length ? `reescrever ${cols.join(", ")} → storage://` : ""}${cols.length && willSetPatient ? "; " : ""}${willSetPatient ? "gravar patient_id" : ""}`;

    if (!APPLY) {
      changes.push({ table: "anamnesis_scheduling_requests", key: id, description, applied: false });
      continue;
    }
    let applied = true;
    if (cols.length > 0) {
      const { error } = await db.from("anamnesis_scheduling_requests").update(patch).eq("id", id);
      if (error) {
        applied = false;
        errors.push(`request ${id}: falha ao reescrever ponteiros (mantido o valor antigo): ${error.message}`);
      }
    }
    if (canSetPatient) {
      const { error } = await db.from("anamnesis_scheduling_requests").update({ patient_id: lead.patientId }).eq("id", id).is("patient_id", null).neq("status", "agendado");
      if (error) {
        applied = false;
        errors.push(`request ${id}: falha ao gravar patient_id: ${error.message}`);
      }
    }
    changes.push({ table: "anamnesis_scheduling_requests", key: id, description, applied });
  }
}

// ---------------------------------------------------------------------
// Etapa 2: sessões do chatbot
// ---------------------------------------------------------------------

async function rewriteSessionPointers(db: Loose, phone: string, migrated: { slot: SessionFileSlot; storagePath: string }[], patientId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: fresh } = await db.from("chatbot_sessions").select("phone_number, collected_data, updated_at").eq("phone_number", phone).maybeSingle();
    if (!fresh) return false;
    const cd = { ...asRecord((fresh as Row).collected_data) };
    for (const m of migrated) if (cd[m.slot.key] === m.slot.url) cd[m.slot.key] = toStoragePointer(m.storagePath); // só se ninguém mexeu
    if (!cd.lead_patient_id) cd.lead_patient_id = patientId;
    // Optimistic lock em updated_at (o bot grava updated_at em toda escrita): se o
    // bot escreveu no meio, relê e refaz o merge em vez de sobrescrever.
    const { data: updated, error } = await db.from("chatbot_sessions").update({ collected_data: cd }).eq("phone_number", phone).eq("updated_at", String((fresh as Row).updated_at)).select("phone_number");
    if (error) {
      errors.push(`session ${phone}: ${error.message}`);
      return false;
    }
    if (updated && updated.length > 0) return true;
  }
  errors.push(`session ${phone}: sessão mudou durante o backfill (3 tentativas) — ponteiros mantidos`);
  return false;
}

async function stepSessions(admin: ReturnType<typeof createAdminClient>, db: Loose, sessions: Row[], rejectedPhones: Set<string>): Promise<void> {
  log("\n[2/5] Sessões do chatbot com URLs do bucket legado");
  for (const s of sessions) {
    const phone = String(s.phone_number);
    const cd = asRecord(s.collected_data);
    const slots = legacySlotsFromRecord(cd);
    if (slots.length === 0) continue;

    if (rejectedPhones.has(normalizeBrLocalPhone(phone))) {
      for (const sl of slots) {
        handledPaths.add(sl.path);
        notMigrated.push({ type: "session", ref: `session:${phone}/${sl.key}`, phone, reason: "requisição rejeitada/cancelada para o telefone (não tocar)" });
      }
      continue;
    }

    const lead = await resolveLead(db, { phone, childName: str(cd.child_name), childBirthDate: str(cd.child_birth_date), guardianName: str(cd.guardian_name), guardianCpf: str(cd.guardian_cpf) }, `session:${phone}`);
    if (!lead) {
      for (const sl of slots) {
        handledPaths.add(sl.path);
        notMigrated.push({ type: "session", ref: `session:${phone}/${sl.key}`, phone, reason: "identidade insuficiente (precisa de nome da criança + nascimento)" });
      }
      continue;
    }

    const migrated: { slot: SessionFileSlot; storagePath: string }[] = [];
    for (const sl of slots) {
      handledPaths.add(sl.path);
      const doc = await attachLegacy(admin, db, lead, phone, sl);
      if (doc.storagePath && (isOk(doc) || doc.outcome === "would_attach")) migrated.push({ slot: sl, storagePath: doc.storagePath });
      else notMigrated.push({ type: "session", ref: `session:${phone}/${sl.key}`, phone, reason: doc.detail ?? "falha ao anexar" });
    }
    if (migrated.length === 0) continue;

    const description = `reescrever ${migrated.map((m) => m.slot.key).join(", ")} → storage:// e gravar lead_patient_id`;
    if (!APPLY) {
      changes.push({ table: "chatbot_sessions", key: phone, description, applied: false });
      continue;
    }
    const applied = await rewriteSessionPointers(db, phone, migrated, lead.patientId);
    changes.push({ table: "chatbot_sessions", key: phone, description, applied });
  }
}

// ---------------------------------------------------------------------
// Etapas 3 e 4: objetos soltos do bucket legado
// ---------------------------------------------------------------------

async function stepLooseObjects(admin: ReturnType<typeof createAdminClient>, db: Loose, rejectedPhones: Set<string>, activePhones: Set<string>): Promise<void> {
  log("\n[3-4/5] Objetos soltos de patient-documents/anamnese-laudos-guias/");
  const { data: listed, error } = await admin.storage.from(LEGACY_BUCKET).list(LEGACY_FOLDER, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) {
    errors.push(`listagem do bucket legado: ${error.message}`);
    return;
  }
  const objects = (listed ?? []).filter((o) => o.id); // ignora "pastas"
  log(`  ${objects.length} objeto(s) no bucket legado`);

  for (const obj of objects) {
    const objectPath = `${LEGACY_FOLDER}/${obj.name}`;
    if (handledPaths.has(objectPath)) continue;
    const ref = `${LEGACY_BUCKET}/${objectPath}`;
    const parsed = parseLegacyObjectName(objectPath);
    if (!parsed) {
      notMigrated.push({ type: "storage_object", ref, phone: null, reason: "nome fora do padrão <epochms>_<tipo>_<telefone>" });
      continue;
    }
    const local = normalizeBrLocalPhone(parsed.phone);
    if (rejectedPhones.has(local) && !activePhones.has(local)) {
      notMigrated.push({ type: "storage_object", ref, phone: parsed.phone, reason: "requisição rejeitada/cancelada para o telefone" });
      continue;
    }

    // Já migrado antes (rodada anterior)? source_key é global aqui.
    const { data: already } = await db.from("documents").select("id, patient_id").eq("source_key", legacySourceKey(objectPath)).limit(1);
    if (already && already.length > 0) {
      changes.push({ table: "documents", key: objectPath, description: "já migrado em rodada anterior (nada a fazer)", applied: true });
      continue;
    }

    const found = await findCandidatesByPhone(db, parsed.phone);
    const all = [...found.candidates, ...(virtualCandidates.get(local) ?? [])];
    if (all.length === 0) {
      notMigrated.push({ type: "storage_object", ref, phone: parsed.phone, reason: "telefone sem paciente (nunca cria paciente sem nome+nascimento)" });
      continue;
    }
    if (all.length > 1) {
      notMigrated.push({ type: "storage_object", ref, phone: parsed.phone, reason: `telefone ligado a ${all.length} pacientes (irmãos) — ambíguo` });
      continue;
    }
    const target = all[0];
    const known = leads.get(target.patientId);
    let entry = known;
    if (!entry) {
      const d = await describeExisting(db, target.patientId);
      entry = registerEntry(target.patientId, { patientId: target.patientId, action: "existing", child: d.child, childBirthDate: d.birth, guardian: d.guardian, guardianCpf: d.cpf, phone: parsed.phone }, "phone-match");
    } else if (!entry.sources.includes("phone-match")) entry.sources.push("phone-match");
    const lead: ResolvedLead = { patientId: target.patientId, entry, virtual: target.patientId.startsWith("dry:") };
    const doc = await attachLegacy(admin, db, lead, parsed.phone, { path: objectPath, kind: parsed.kind });
    if (!isOk(doc) && doc.outcome !== "would_attach") notMigrated.push({ type: "storage_object", ref, phone: parsed.phone, reason: doc.detail ?? "falha ao anexar" });
    handledPaths.add(objectPath);
  }
}

// ---------------------------------------------------------------------
// Etapa 5: rascunhos de cadastro assistido por IA
// ---------------------------------------------------------------------

async function stepDrafts(db: Loose): Promise<void> {
  log("\n[5/5] Rascunhos registration_drafts");
  if (args.skipDrafts) {
    log("  --skip-drafts: ignorado.");
    return;
  }
  const statuses = args.includeExtractedDrafts ? ["pending", "failed", "extracted"] : ["pending", "failed"];
  const { data } = await db.from("registration_drafts").select("id, status, source_phone, patient_id, error").in("status", statuses).order("created_at", { ascending: true });
  const drafts = ((data ?? []) as Row[]).filter((d) => d.status !== "extracted" || !d.patient_id);

  if (APPLY && drafts.some((d) => d.status !== "extracted") && !process.env.GEMINI_API_KEY) {
    errors.push("GEMINI_API_KEY ausente: rascunhos pending/failed NÃO foram processados.");
    for (const d of drafts) draftEntries.push({ draftId: String(d.id), phone: str(d.source_phone), status: String(d.status), files: 0, outcome: "skipped_no_gemini_key" });
    return;
  }

  for (const d of drafts) {
    const draftId = String(d.id);
    const { count } = await db.from("registration_draft_files").select("id", { count: "exact", head: true }).eq("draft_id", draftId);
    const entry: DraftEntry = { draftId, phone: str(d.source_phone), status: String(d.status), files: count ?? 0, outcome: "" };
    draftEntries.push(entry);

    if (!APPLY) {
      entry.outcome = d.status === "extracted" ? "would_promote_to_lead" : "would_extract_with_gemini_then_promote";
      continue;
    }

    if (d.status !== "extracted") {
      const outcomes = await claimAndProcessDrafts({ draftId });
      const o = outcomes[0];
      if (!o || o.status !== "extracted") {
        entry.outcome = "extraction_failed";
        entry.error = o?.error ?? "não reivindicado";
        notMigrated.push({ type: "draft", ref: `draft:${draftId}`, phone: entry.phone, reason: `extração falhou: ${entry.error}` });
        continue;
      }
    }
    const promoted = await promoteDraftToLead(draftId);
    if (!promoted) {
      entry.outcome = "extracted_but_not_promoted";
      notMigrated.push({ type: "draft", ref: `draft:${draftId}`, phone: entry.phone, reason: "extraído, mas sem nome+nascimento para criar o lead (continua na fila /recepcao/pre-cadastros)" });
      continue;
    }
    entry.outcome = "promoted";
    entry.patientId = promoted.patientId;
    const dd = await describeExisting(db, promoted.patientId);
    const known = leads.get(promoted.patientId);
    const leadEntry = known ?? registerEntry(promoted.patientId, { patientId: promoted.patientId, action: "existing", child: dd.child, childBirthDate: dd.birth, guardian: dd.guardian, guardianCpf: dd.cpf, phone: entry.phone ?? "" }, `draft:${draftId}`);
    if (!leadEntry.sources.includes(`draft:${draftId}`)) leadEntry.sources.push(`draft:${draftId}`);
    const { count: docCount } = await db.from("registration_draft_files").select("id", { count: "exact", head: true }).eq("draft_id", draftId).not("document_id", "is", null);
    leadEntry.documents.push({ objectPath: `draft:${draftId}`, kind: "rascunho", outcome: "attached", detail: `${docCount ?? 0} arquivo(s) do rascunho copiados para documents` });
    leadEntry.documentsAttached += docCount ?? 0;
  }
}

// ---------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------

function printReport(): Record<string, unknown> {
  const leadList = [...leads.values()];
  const counters = {
    mode: APPLY ? "apply" : "dry-run",
    leadsToCreate: leadList.filter((l) => l.action === "would_create").length,
    leadsCreated: leadList.filter((l) => l.action === "created").length,
    leadsExistingTouched: leadList.filter((l) => l.action === "existing").length,
    documentsAttached: leadList.reduce((n, l) => n + l.documents.filter((d) => d.outcome === "attached" && !d.objectPath.startsWith("draft:")).length, 0),
    draftsPromoted: draftEntries.filter((d) => d.outcome === "promoted").length,
    documentsWouldAttach: leadList.reduce((n, l) => n + l.documents.filter((d) => d.outcome === "would_attach").length, 0),
    documentsAlreadyAttached: leadList.reduce((n, l) => n + l.documents.filter((d) => d.outcome === "already_attached").length, 0),
    documentsFailed: leadList.reduce((n, l) => n + l.documents.filter((d) => d.outcome === "failed").length, 0),
    changesPlannedOrApplied: changes.length,
    notMigrated: notMigrated.length,
    draftsListedOrProcessed: draftEntries.length,
    errors: errors.length,
  };

  log("\n==================== RELATÓRIO ====================");
  log(`Modo: ${APPLY ? "APPLY (escreveu no banco)" : "DRY-RUN (nada foi escrito)"}`);
  for (const [k, v] of Object.entries(counters)) if (k !== "mode") log(`  ${k}: ${v}`);

  log("\n-- Leads --");
  for (const l of leadList) {
    log(`* [${l.action}] criança: ${l.child ?? "?"} (${l.childBirthDate ?? "?"}) | responsável: ${l.guardian ?? "?"} (CPF ${l.guardianCpf ?? "-"}) | tel: ${l.phone} | docs: ${l.documentsAttached} | patient_id: ${l.patientId ?? "(novo)"} | origem: ${l.sources.join(", ")}`);
    for (const d of l.documents) {
      log(`    - ${d.outcome.padEnd(16)} ${d.kind.padEnd(11)} ${d.objectPath}${d.detectedMime ? ` [${d.detectedMime}${d.sizeBytes ? `, ${Math.round(d.sizeBytes / 1024)}KB` : ""}]` : ""}${d.detail ? ` — ${d.detail}` : ""}`);
    }
  }
  log("\n-- Alterações em linhas existentes --");
  for (const c of changes) log(`  ${c.applied ? "[feito]" : "[plano]"} ${c.table} ${c.key}: ${c.description}`);
  log("\n-- NÃO migrados (nada foi apagado) --");
  for (const n of notMigrated) log(`  ${n.type} ${n.ref}${n.phone ? ` (${n.phone})` : ""}: ${n.reason}`);
  log("\n-- Rascunhos --");
  for (const d of draftEntries) log(`  draft ${d.draftId} ${d.phone ?? "-"} [${d.status}] ${d.files} arquivo(s): ${d.outcome}${d.error ? ` (${d.error})` : ""}${d.patientId ? ` → paciente ${d.patientId}` : ""}`);
  if (errors.length > 0) {
    log("\n-- Erros --");
    for (const e of errors) log(`  ${e}`);
  }

  return { generatedAt: new Date().toISOString(), counters, leads: leadList, changes, notMigrated, drafts: draftEntries, errors };
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnvLocal();
  if (args.unknown.length > 0) {
    console.error(`Argumento(s) desconhecido(s): ${args.unknown.join(" ")}. Use --dry-run (padrão) ou --apply [--skip-drafts] [--include-extracted-drafts] [--enrich].`);
    process.exit(2);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (.env.local).");
    process.exit(2);
  }
  log(APPLY ? "MODO --apply: vai ESCREVER no banco/Storage." : "MODO --dry-run (padrão): somente leitura, nada será escrito.");

  const admin = createAdminClient();
  const db = admin as unknown as Loose; // colunas novas de `documents`/requisições ainda fora de database.types.ts

  const { data: sessionRows } = await db.from("chatbot_sessions").select("phone_number, current_step, collected_data, updated_at");
  const sessions = (sessionRows ?? []) as Row[];

  // Telefones com requisição rejeitada/cancelada e SEM requisição ativa: intocáveis.
  const { data: reqRows } = await db.from("anamnesis_scheduling_requests").select("guardian_phone, status");
  const activePhones = new Set<string>();
  const rejectedPhones = new Set<string>();
  for (const r of (reqRows ?? []) as Row[]) {
    const local = normalizeBrLocalPhone(String(r.guardian_phone ?? ""));
    if (ACTIVE_REQUEST_STATUSES.has(String(r.status))) activePhones.add(local);
    else rejectedPhones.add(local);
  }
  for (const p of activePhones) rejectedPhones.delete(p); // só "rejeitado sem ativo" bloqueia a sessão
  const blockedPhones = new Set([...rejectedPhones]);

  await stepRequests(admin, db, sessions);
  await stepSessions(admin, db, sessions, blockedPhones);
  await stepLooseObjects(admin, db, blockedPhones, activePhones);
  await stepDrafts(db);

  if (APPLY && args.enrich) {
    log("\n[extra] --enrich: lendo documentos dos leads com o Gemini");
    for (const l of leads.values()) if (l.patientId && l.documentsAttached > 0) await enrichLeadFromDocuments(l.patientId);
  }

  const report = printReport();
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  log(`\nRelatório JSON: ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("Falha inesperada no backfill:", err instanceof Error ? err.message : err);
  process.exit(1);
});
