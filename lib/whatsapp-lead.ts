// lib/whatsapp-lead.ts
// Cadastro automático de LEAD a partir de documentos enviados por WhatsApp.
// Assim que o responsável manda um arquivo (laudo, guia, carteirinha...), o
// telefone vira um paciente-lead (`patients.status='interessado'`) com o
// responsável (`guardians`) e uma linha em `documents` por arquivo — o
// arquivo em si vai pro bucket PRIVADO `clinic-documents`. É isso que faz a
// aba "Documentos" do prontuário e o painel de leads da supervisão enxergarem
// o que a família mandou (antes, os arquivos iam para um bucket público, com
// Content-Type forçado para PDF, e nenhuma linha em `documents` era criada).
//
// Regras herdadas do projeto: nada de dado fabricado (só cria paciente com
// nome+nascimento válidos; o resto só é preenchido quando o campo está em
// branco) e nenhuma função aqui lança para o webhook — falha volta como
// `null`/`{ ok: false }` e é logada.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import type { Json } from "@/lib/database.types";
import { formatE164Phone } from "@/lib/twilio";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  downloadTwilioMedia,
  sanitizeFileName,
} from "@/lib/registration-drafts-ingest";
import {
  applyNormalization,
  extractRegistrationFromFiles,
  normalizeCpf,
  type DocumentExtraction,
} from "@/lib/document-extraction";
import {
  GUARDIAN_PLACEHOLDER_NAME,
  buildLeadStoragePath,
  coerceLeadKind,
  ensureExtension,
  isLeadIdentityComplete,
  isPlaceholderGuardianName,
  kindToCategory,
  mimeFromExtension,
  normalizeBirthDate,
  normalizeCpfDigits,
  normalizeEmail,
  normalizeFullName,
  phoneDigits,
  pickLeadCandidate,
  sniffFileType,
  type LeadCandidate,
  type LeadDocKind,
} from "@/lib/whatsapp-lead-pure";

const DOCUMENTS_BUCKET = "clinic-documents";
const LEAD_ENTRY_SOURCE = "chatbot_whatsapp";
// Mesmos tetos de lib/registration-drafts-process.ts (payload inline do Gemini).
const MAX_ENRICH_FILES = 6;
const MAX_ENRICH_TOTAL_BYTES = 18 * 1024 * 1024;

export type LeadIdentity = {
  phone: string;
  childName?: string | null;
  childBirthDate?: string | null;
  guardianName?: string | null;
  guardianCpf?: string | null;
  guardianEmail?: string | null;
};

type Admin = ReturnType<typeof createAdminClient>;
// `documents` ganhou colunas (source, source_key, original_name, mime_type) e
// `uploaded_by` virou nullable na migration 20260921020000; enquanto
// lib/database.types.ts não for regenerado, essas operações usam um cliente
// sem tipagem de schema.
type LooseClient = SupabaseClient;
const loose = (admin: Admin): LooseClient => admin as unknown as LooseClient;

// Cópia de lib/twilio.ts:normalizeBrLocalPhone (não exportada) — DDD + 8
// dígitos, ignorando o "9" opcional do celular.
function normalizeBrLocalPhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return digits.slice(0, 2) + digits.slice(3);
  return digits;
}

type GuardianRow = { id: string; patient_id: string; full_name: string; phone: string; cpf: string | null; email: string | null };

/**
 * Pacientes da clínica ligados ao telefone. Não usa `resolvePatientFromPhone`
 * porque ele devolve só o primeiro — e irmãos compartilham o telefone do
 * responsável, então precisamos escolher a criança certa (pickLeadCandidate).
 */
async function findLeadCandidates(
  admin: Admin,
  phone: string,
): Promise<{ candidates: LeadCandidate[]; guardians: Map<string, GuardianRow> }> {
  const empty = { candidates: [] as LeadCandidate[], guardians: new Map<string, GuardianRow>() };
  const last8 = phoneDigits(phone).slice(-8);
  if (last8.length < 8) return empty;

  // Cadastros antigos gravam o telefone em formato BR cru, com hífen.
  const hyphenated = `${last8.slice(0, 4)}-${last8.slice(4)}`;
  const { data: guardians } = await admin
    .from("guardians")
    .select("id, patient_id, full_name, phone, cpf, email")
    .or(`phone.ilike.%${last8},phone.ilike.%${hyphenated}`);

  const target = normalizeBrLocalPhone(phone);
  const matching = (guardians ?? []).filter((g) => normalizeBrLocalPhone(g.phone) === target);
  if (matching.length === 0) return empty;

  const { data: patients } = await admin
    .from("patients")
    .select("id, full_name, birth_date, status, created_at")
    .eq("clinic_id", DEV_CLINIC_ID)
    .in("id", [...new Set(matching.map((g) => g.patient_id))]);

  const byGuardian = new Map<string, GuardianRow>();
  for (const g of matching) if (!byGuardian.has(g.patient_id)) byGuardian.set(g.patient_id, g);

  const candidates: LeadCandidate[] = (patients ?? []).map((p) => ({
    patientId: p.id,
    fullName: p.full_name,
    birthDate: p.birth_date,
    status: p.status,
    createdAt: p.created_at,
  }));
  return { candidates, guardians: byGuardian };
}

async function fillGuardianBlanks(
  admin: Admin,
  guardian: GuardianRow,
  fields: { name: string | null; cpf: string | null; email: string | null },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (fields.name && isPlaceholderGuardianName(guardian.full_name)) patch.full_name = fields.name;
  if (fields.cpf && !guardian.cpf) patch.cpf = fields.cpf;
  if (fields.email && !guardian.email) patch.email = fields.email;
  if (Object.keys(patch).length === 0) return;
  const { error } = await loose(admin).from("guardians").update(patch).eq("id", guardian.id);
  if (error) console.error("[WhatsApp Lead] Falha ao completar responsável:", error.message);
}

async function insertAudit(
  admin: Admin,
  patientId: string,
  action: string,
  after: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    table_name: "patients",
    row_id: patientId,
    action,
    clinic_id: DEV_CLINIC_ID,
    after: after as Json,
  });
  if (error) console.error(`[WhatsApp Lead] Falha ao gravar audit_log (${action}):`, error.message);
}

/**
 * Descarta um paciente-lead que ACABAMOS de criar (rollback / corrida). Um
 * trigger do banco cria as `intake_steps` de todo paciente novo, então elas
 * precisam sair antes — senão a FK impede o delete e sobra um paciente órfão.
 */
async function discardNewLead(admin: Admin, patientId: string, guardianId?: string): Promise<void> {
  if (guardianId) await admin.from("guardians").delete().eq("id", guardianId);
  await admin.from("intake_steps").delete().eq("patient_id", patientId);
  const { error } = await admin.from("patients").delete().eq("id", patientId);
  if (error) console.error("[WhatsApp Lead] Falha ao descartar lead duplicado:", error.message);
}

/**
 * Garante o paciente-lead + responsável do telefone. Idempotente:
 * - já existe paciente ligado ao telefone (e à criança citada, se houver
 *   nascimento/nome) → reaproveita e só preenche campos do responsável que
 *   estejam em branco (nunca sobrescreve);
 * - não existe e nome+nascimento válidos → cria paciente `interessado`
 *   (entry_source `chatbot_whatsapp`) + responsável financeiro/emergência;
 * - falta dado → `null` (o chamador guarda o arquivo como pendente).
 * O CPF informado é do RESPONSÁVEL — nunca vai para `patients.cpf`.
 */
export async function upsertWhatsappLead(
  identity: LeadIdentity,
): Promise<{ patientId: string; guardianId: string; created: boolean } | null> {
  try {
    const phone = formatE164Phone((identity.phone ?? "").replace("whatsapp:", ""));
    if (!phone) return null;

    const childName = normalizeFullName(identity.childName);
    const childBirthDate = normalizeBirthDate(identity.childBirthDate);
    const guardianName = normalizeFullName(identity.guardianName);
    const guardianCpf = normalizeCpfDigits(identity.guardianCpf);
    const guardianEmail = normalizeEmail(identity.guardianEmail);
    const admin = createAdminClient();

    const found = await findLeadCandidates(admin, phone);
    const picked = pickLeadCandidate(found.candidates, { childName, childBirthDate });
    const pickedGuardian = picked ? found.guardians.get(picked.patientId) : undefined;
    if (picked && pickedGuardian) {
      await fillGuardianBlanks(admin, pickedGuardian, { name: guardianName, cpf: guardianCpf, email: guardianEmail });
      return { patientId: picked.patientId, guardianId: pickedGuardian.id, created: false };
    }

    if (!childName || !childBirthDate || !isLeadIdentityComplete({ childName, childBirthDate })) return null;

    const { data: patient, error: patientError } = await admin
      .from("patients")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        full_name: childName,
        birth_date: childBirthDate,
        status: "interessado",
        entry_source: LEAD_ENTRY_SOURCE,
        first_contact_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (patientError || !patient) {
      console.error("[WhatsApp Lead] Falha ao criar paciente-lead:", patientError?.message);
      return null;
    }

    const { data: guardian, error: guardianError } = await admin
      .from("guardians")
      .insert({
        patient_id: patient.id,
        // `guardians.full_name` é NOT NULL: sem nome ainda, um rótulo neutro
        // (substituído quando o nome real chegar — ver isPlaceholderGuardianName).
        full_name: guardianName ?? GUARDIAN_PLACEHOLDER_NAME,
        phone,
        cpf: guardianCpf,
        email: guardianEmail,
        is_financial: true,
        is_emergency_contact: true,
      })
      .select("id")
      .single();
    if (guardianError || !guardian) {
      console.error("[WhatsApp Lead] Falha ao criar responsável do lead:", guardianError?.message);
      await discardNewLead(admin, patient.id); // só o que acabamos de criar
      return null;
    }

    // Corrida: o Twilio entrega várias fotos em webhooks simultâneos e não há
    // unicidade por telefone. Relê; se outro webhook criou o mesmo lead antes
    // (vence o mais antigo, desempate por id — todos calculam o mesmo
    // vencedor), descarta o nosso e usa o dele.
    const again = await findLeadCandidates(admin, phone);
    const winner = pickLeadCandidate(again.candidates, { childName, childBirthDate });
    const winnerGuardian = winner ? again.guardians.get(winner.patientId) : undefined;
    if (winner && winnerGuardian && winner.patientId !== patient.id) {
      await discardNewLead(admin, patient.id, guardian.id);
      await fillGuardianBlanks(admin, winnerGuardian, { name: guardianName, cpf: guardianCpf, email: guardianEmail });
      return { patientId: winner.patientId, guardianId: winnerGuardian.id, created: false };
    }

    // A criação já fica no audit_log pelo trigger genérico (action INSERT).
    return { patientId: patient.id, guardianId: guardian.id, created: true };
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em upsertWhatsappLead:", err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------

export type AttachLeadDocumentResult =
  | { ok: true; documentId: string; storagePath: string; mime: string; duplicate: boolean }
  // `code` deixa o chamador separar formato não suportado de falha técnica.
  | { ok: false; error: string; code?: "unsupported" | "too_large" | "failed" };

async function findExistingDocument(db: LooseClient, patientId: string, sourceKey: string) {
  const { data } = await db
    .from("documents")
    .select("id, storage_path, mime_type")
    .eq("patient_id", patientId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  return (data as { id: string; storage_path: string; mime_type: string | null } | null) ?? null;
}

/**
 * Sobe o arquivo para `clinic-documents` e registra a linha em `documents`
 * do paciente. O tipo REAL do conteúdo (magic bytes) decide mime e extensão —
 * o Content-Type informado pelo Twilio só serve de dica. Reentrega do mesmo
 * arquivo (mesmo `sourceKey`) devolve o documento existente com
 * `duplicate: true`, sem objeto órfão no Storage.
 */
export async function attachLeadDocument(params: {
  patientId: string;
  phone: string;
  buffer: Buffer | Uint8Array;
  kind: LeadDocKind;
  sourceKey: string;
  originalName?: string;
  contentTypeHint?: string;
}): Promise<AttachLeadDocumentResult> {
  try {
    const { patientId, phone, buffer, kind, sourceKey } = params;
    if (buffer.byteLength === 0) return { ok: false, error: "Arquivo vazio.", code: "failed" };
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return { ok: false, error: "Arquivo acima do limite de 25MB.", code: "too_large" };
    }

    const sniffed = sniffFileType(buffer);
    if (!sniffed || !ALLOWED_MIME_TYPES.has(sniffed.mime)) {
      return { ok: false, error: "Formato de arquivo não suportado (só PDF, JPG, PNG, WEBP ou HEIC).", code: "unsupported" };
    }
    const hint = (params.contentTypeHint ?? "").split(";")[0].trim();
    if (hint && hint !== sniffed.mime) {
      console.warn(`[WhatsApp Lead] Content-Type informado (${hint}) difere do conteúdo real (${sniffed.mime}); usando o real.`);
    }

    const admin = createAdminClient();
    const db = loose(admin);

    const existing = await findExistingDocument(db, patientId, sourceKey);
    if (existing) {
      return { ok: true, documentId: existing.id, storagePath: existing.storage_path, mime: existing.mime_type ?? sniffed.mime, duplicate: true };
    }

    const storagePath = buildLeadStoragePath({ phone, kind, ext: sniffed.ext });
    const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, buffer, {
      contentType: sniffed.mime,
      upsert: false,
    });
    if (uploadError) {
      console.error("[WhatsApp Lead] Falha ao subir arquivo:", uploadError.message);
      return { ok: false, error: "Falha ao salvar o arquivo.", code: "failed" };
    }

    const originalName = ensureExtension(sanitizeFileName(params.originalName ?? kind), sniffed.ext);
    const { data: inserted, error: insertError } = await db
      .from("documents")
      .insert({
        patient_id: patientId,
        category: kindToCategory(kind),
        storage_path: storagePath,
        uploaded_by: null,
        shared_with_family: false,
        note: "Enviado por WhatsApp",
        source: "whatsapp",
        source_key: sourceKey,
        original_name: originalName,
        mime_type: sniffed.mime,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // Sem órfãos: o objeto recém-subido não tem linha que o referencie.
      await admin.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      if (insertError?.code === "23505") {
        // Corrida com outra entrega do mesmo arquivo: devolve a linha vencedora.
        const winner = await findExistingDocument(db, patientId, sourceKey);
        if (winner) {
          return { ok: true, documentId: winner.id, storagePath: winner.storage_path, mime: winner.mime_type ?? sniffed.mime, duplicate: true };
        }
      }
      console.error("[WhatsApp Lead] Falha ao registrar documento:", insertError?.message);
      return { ok: false, error: "Falha ao registrar o documento.", code: "failed" };
    }

    return { ok: true, documentId: (inserted as { id: string }).id, storagePath, mime: sniffed.mime, duplicate: false };
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em attachLeadDocument:", err);
    return { ok: false, error: "Falha inesperada ao salvar o documento.", code: "failed" };
  }
}

function isAlreadyExistsError(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  return String(error.statusCode) === "409" || /already exists|Duplicate/i.test(error.message ?? "");
}

/**
 * Salva o arquivo em `leads/pending/<telefone>/…` quando ainda não há
 * paciente (nome+nascimento desconhecidos), para não perder o documento.
 * A chave é o hash da URL da mídia: reentrega do webhook cai no mesmo objeto.
 */
async function savePendingLeadFile(params: {
  admin: Admin;
  phone: string;
  buffer: Buffer;
  kind: LeadDocKind;
  mediaUrl: string;
}): Promise<{ ok: true; storagePath: string; duplicate: boolean } | { ok: false; code: "unsupported" | "too_large" | "failed" }> {
  const sniffed = sniffFileType(params.buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.has(sniffed.mime)) return { ok: false, code: "unsupported" };
  if (params.buffer.byteLength > MAX_FILE_BYTES) return { ok: false, code: "too_large" };

  const storagePath = buildLeadStoragePath({
    phone: params.phone,
    kind: params.kind,
    ext: sniffed.ext,
    pending: true,
    stableKey: createHash("sha1").update(params.mediaUrl).digest("hex").slice(0, 16),
  });
  const { error } = await params.admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, params.buffer, {
    contentType: sniffed.mime,
    upsert: false,
  });
  if (error) {
    if (isAlreadyExistsError(error as { message?: string; statusCode?: string })) return { ok: true, storagePath, duplicate: true };
    console.error("[WhatsApp Lead] Falha ao salvar arquivo pendente:", error.message);
    return { ok: false, code: "failed" };
  }
  return { ok: true, storagePath, duplicate: false };
}

/**
 * Converte os arquivos que ficaram em `leads/pending/<telefone>/` (recebidos
 * antes de o lead ter nome+nascimento) em documentos do paciente, movendo o
 * objeto — sem baixar/subir de novo. Nunca lança.
 */
export async function adoptPendingLeadFiles(params: {
  phone: string;
  patientId: string;
}): Promise<{ adopted: number; documentIds: string[]; storagePaths: string[] }> {
  const result = { adopted: 0, documentIds: [] as string[], storagePaths: [] as string[] };
  try {
    const phone = formatE164Phone(params.phone.replace("whatsapp:", ""));
    if (!phone) return result;
    const admin = createAdminClient();
    const db = loose(admin);
    const folder = `leads/pending/${phoneDigits(phone)}`;
    const { data: files } = await admin.storage.from(DOCUMENTS_BUCKET).list(folder, { limit: 100 });

    for (const file of files ?? []) {
      const match = file.name.match(/^(.+)-([a-z_]+)\.([a-z0-9]+)$/);
      const mime = match ? mimeFromExtension(match[3]) : null;
      if (!match || !mime) continue;
      const kind = coerceLeadKind(match[2]);
      const sourceKey = `pending:${match[1]}`;

      const existing = await findExistingDocument(db, params.patientId, sourceKey);
      const from = `${folder}/${file.name}`;
      if (existing) {
        await admin.storage.from(DOCUMENTS_BUCKET).remove([from]);
        continue;
      }

      const to = buildLeadStoragePath({ phone, kind, ext: match[3] });
      const { error: moveError } = await admin.storage.from(DOCUMENTS_BUCKET).move(from, to);
      if (moveError) {
        console.error("[WhatsApp Lead] Falha ao mover arquivo pendente:", moveError.message);
        continue;
      }
      const { data: inserted, error: insertError } = await db
        .from("documents")
        .insert({
          patient_id: params.patientId,
          category: kindToCategory(kind),
          storage_path: to,
          uploaded_by: null,
          shared_with_family: false,
          note: "Enviado por WhatsApp",
          source: "whatsapp",
          source_key: sourceKey,
          original_name: `${kind}.${match[3]}`,
          mime_type: mime,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        console.error("[WhatsApp Lead] Falha ao registrar arquivo pendente:", insertError?.message);
        await admin.storage.from(DOCUMENTS_BUCKET).move(to, from); // devolve: sem órfão nem perda
        continue;
      }
      result.adopted++;
      result.documentIds.push((inserted as { id: string }).id);
      result.storagePaths.push(to);
    }
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em adoptPendingLeadFiles:", err);
  }
  return result;
}

export type RegisterLeadMediaResult = {
  saved: number;
  duplicates: number;
  unsupported: number;
  failed: number;
  patientId: string | null;
  documentIds: string[];
  storagePaths: string[];
  /** Arquivos pendentes de mensagens anteriores que viraram documentos agora. */
  adopted: number;
};

/**
 * Ponto de entrada do bot: garante o lead (se a identidade permitir), baixa
 * cada mídia do Twilio e a registra como documento. Sem paciente (dados
 * insuficientes) o arquivo NÃO se perde: vai para `leads/pending/<telefone>/`
 * e `patientId` volta null — quem chama decide o que fazer (por exemplo,
 * pedir nome e nascimento e chamar de novo, o que adota os pendentes).
 */
export async function registerLeadMedia(params: {
  identity: LeadIdentity;
  media: { url: string; contentType?: string }[];
  kind: LeadDocKind;
}): Promise<RegisterLeadMediaResult> {
  const result: RegisterLeadMediaResult = {
    saved: 0,
    duplicates: 0,
    unsupported: 0,
    failed: 0,
    patientId: null,
    documentIds: [],
    storagePaths: [],
    adopted: 0,
  };

  try {
    const phone = formatE164Phone((params.identity.phone ?? "").replace("whatsapp:", ""));
    if (!phone) {
      result.failed = params.media.length;
      return result;
    }
    const admin = createAdminClient();
    const lead = await upsertWhatsappLead({ ...params.identity, phone });
    result.patientId = lead?.patientId ?? null;

    if (lead) {
      const adopted = await adoptPendingLeadFiles({ phone, patientId: lead.patientId });
      result.adopted = adopted.adopted;
      result.documentIds.push(...adopted.documentIds);
      result.storagePaths.push(...adopted.storagePaths);
    }

    for (const item of params.media) {
      if (lead) {
        const existing = await findExistingDocument(loose(admin), lead.patientId, item.url);
        if (existing) {
          result.duplicates++;
          result.documentIds.push(existing.id);
          result.storagePaths.push(existing.storage_path);
          continue;
        }
      }

      const downloaded = await downloadTwilioMedia(item.url, item.contentType);
      if (!downloaded) {
        result.failed++;
        continue;
      }

      if (lead) {
        const attached = await attachLeadDocument({
          patientId: lead.patientId,
          phone,
          buffer: downloaded.buffer,
          kind: params.kind,
          sourceKey: item.url,
          contentTypeHint: downloaded.mime,
        });
        if (attached.ok) {
          if (attached.duplicate) result.duplicates++;
          else result.saved++;
          result.documentIds.push(attached.documentId);
          result.storagePaths.push(attached.storagePath);
        } else if (attached.code === "unsupported") result.unsupported++;
        else result.failed++;
        continue;
      }

      const pending = await savePendingLeadFile({ admin, phone, buffer: downloaded.buffer, kind: params.kind, mediaUrl: item.url });
      if (pending.ok) {
        if (pending.duplicate) result.duplicates++;
        else result.saved++;
        result.storagePaths.push(pending.storagePath);
      } else if (pending.code === "unsupported") result.unsupported++;
      else result.failed++;
    }
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em registerLeadMedia:", err);
    const handled = result.saved + result.duplicates + result.unsupported + result.failed;
    result.failed += Math.max(0, params.media.length - handled);
  }
  return result;
}

// ---------------------------------------------------------------------
// Enriquecimento por IA
// ---------------------------------------------------------------------

/**
 * Aplica uma extração (DocumentExtraction já normalizada) ao lead, SÓ em
 * campos em branco — nunca sobrescreve o que o responsável digitou ou a
 * recepção corrigiu. Devolve os nomes dos campos preenchidos.
 */
async function applyExtractionToLead(
  admin: Admin,
  patientId: string,
  extraction: DocumentExtraction,
  reclassify: { documentId: string; kind: LeadDocKind }[],
): Promise<{ filled: string[]; insuranceCreated: boolean; reclassified: number }> {
  const db = loose(admin);
  const filled: string[] = [];
  let insuranceCreated = false;
  let reclassified = 0;

  const { data: patient } = await admin
    .from("patients")
    .select("id, clinic_id, cid, complaint, sexo, naturalidade, cpf, address_cep, address_logradouro, address_numero, address_complemento, address_bairro, address_cidade, address_uf")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) return { filled, insuranceCreated, reclassified };

  const blank = (v: string | null | undefined) => !v || !v.trim();
  const patientPatch: Record<string, string> = {};
  const setPatient = (column: keyof typeof patient, value: string | null) => {
    if (value && blank(patient[column] as string | null)) patientPatch[column] = value;
  };
  setPatient("cid", extraction.patient.cid);
  setPatient("complaint", extraction.patient.complaint_hint);
  setPatient("sexo", extraction.patient.sexo);
  setPatient("naturalidade", extraction.patient.naturalidade);
  setPatient("address_cep", extraction.address.cep);
  setPatient("address_logradouro", extraction.address.logradouro);
  setPatient("address_numero", extraction.address.numero);
  setPatient("address_complemento", extraction.address.complemento);
  setPatient("address_bairro", extraction.address.bairro);
  setPatient("address_cidade", extraction.address.cidade);
  setPatient("address_uf", extraction.address.uf);

  // CPF da CRIANÇA (índice único por clínica): pula se outro paciente já o usa.
  const childCpf = normalizeCpf(extraction.patient.cpf);
  if (childCpf && blank(patient.cpf)) {
    const { data: clash } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", patient.clinic_id)
      .eq("cpf", childCpf)
      .neq("id", patientId)
      .maybeSingle();
    if (!clash) patientPatch.cpf = childCpf;
  }

  if (Object.keys(patientPatch).length > 0) {
    const { error } = await db.from("patients").update(patientPatch).eq("id", patientId);
    if (error) console.error("[WhatsApp Lead] Falha ao enriquecer paciente:", error.message);
    else filled.push(...Object.keys(patientPatch).map((c) => `patients.${c}`));
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, full_name, cpf, email, rg, relationship")
    .eq("patient_id", patientId)
    .order("is_emergency_contact", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (guardian) {
    const guardianPatch: Record<string, string> = {};
    const email = normalizeEmail(extraction.guardian.email);
    if (email && blank(guardian.email)) guardianPatch.email = email;
    const guardianCpf = normalizeCpf(extraction.guardian.cpf);
    if (guardianCpf && blank(guardian.cpf) && guardianCpf !== (patientPatch.cpf ?? patient.cpf)) guardianPatch.cpf = guardianCpf;
    if (extraction.guardian.rg && blank(guardian.rg)) guardianPatch.rg = extraction.guardian.rg;
    if (extraction.guardian.relationship && blank(guardian.relationship)) guardianPatch.relationship = extraction.guardian.relationship;
    const guardianName = normalizeFullName(extraction.guardian.full_name);
    if (guardianName && isPlaceholderGuardianName(guardian.full_name)) guardianPatch.full_name = guardianName;

    if (Object.keys(guardianPatch).length > 0) {
      const { error } = await db.from("guardians").update(guardianPatch).eq("id", guardian.id);
      if (error) console.error("[WhatsApp Lead] Falha ao enriquecer responsável:", error.message);
      else filled.push(...Object.keys(guardianPatch).map((c) => `guardians.${c}`));
    }
  }

  // Convênio: só quando o plano casou com um `insurers` e há número de cartão;
  // não duplica se o paciente já tem vínculo com o mesmo convênio.
  const { insurer_id: insurerId, card_number: cardNumber } = extraction.insurance;
  if (insurerId && cardNumber) {
    const { data: existing } = await admin
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", patientId)
      .eq("insurer_id", insurerId)
      .limit(1);
    if (!existing || existing.length === 0) {
      const { error } = await admin.from("patient_insurance").insert({
        patient_id: patientId,
        insurer_id: insurerId,
        card_number: cardNumber,
        plan_name: extraction.insurance.plan_name,
        card_valid_until: extraction.insurance.card_valid_until,
        is_private: false,
      });
      if (error) console.error("[WhatsApp Lead] Falha ao criar convênio do lead:", error.message);
      else {
        insuranceCreated = true;
        filled.push("patient_insurance");
      }
    }
  }

  // Reclassifica SÓ o que ficou como 'outro' (nunca troca uma categoria já específica).
  for (const item of reclassify) {
    if (item.kind === "outro") continue;
    const { data } = await db
      .from("documents")
      .update({ category: kindToCategory(item.kind) })
      .eq("id", item.documentId)
      .eq("category", "outro")
      .select("id");
    if (data && data.length > 0) reclassified++;
  }

  return { filled, insuranceCreated, reclassified };
}

const CATEGORY_PRIORITY = ["carteirinha", "laudo", "autorizacao", "pedido_medico", "certidao_nascimento", "documento_identidade", "comprovante_residencia"];

/**
 * Lê (Gemini) os documentos do WhatsApp do lead e completa o cadastro nos
 * campos em branco. Nunca lança; sem GEMINI_API_KEY apenas retorna. Não
 * repete a chamada quando o conjunto de documentos é o mesmo da última
 * execução (registrada em audit_log `lead_enriched`).
 */
export async function enrichLeadFromDocuments(patientId: string): Promise<void> {
  try {
    if (!process.env.GEMINI_API_KEY) return;
    const admin = createAdminClient();
    const db = loose(admin);

    const { data: docsRaw } = await db
      .from("documents")
      .select("id, storage_path, category, mime_type, uploaded_at")
      .eq("patient_id", patientId)
      .eq("source", "whatsapp")
      .order("uploaded_at", { ascending: true });
    const priority = (category: string) => {
      const i = CATEGORY_PRIORITY.indexOf(category);
      return i === -1 ? CATEGORY_PRIORITY.length : i;
    };
    const docs = ((docsRaw ?? []) as { id: string; storage_path: string; category: string; mime_type: string | null }[])
      .filter((d) => ALLOWED_MIME_TYPES.has(d.mime_type ?? ""))
      .sort((a, b) => priority(a.category) - priority(b.category))
      .slice(0, MAX_ENRICH_FILES);
    if (docs.length === 0) return;

    const signature = docs.map((d) => d.id).sort();
    const { data: lastRun } = await admin
      .from("audit_log")
      .select("after")
      .eq("table_name", "patients")
      .eq("row_id", patientId)
      .eq("action", "lead_enriched")
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastIds = (lastRun?.after as { document_ids?: string[] } | null)?.document_ids;
    if (lastIds && lastIds.length === signature.length && [...lastIds].sort().every((id, i) => id === signature[i])) return;

    const files: { base64: string; mimeType: string; index: number; documentId: string }[] = [];
    let total = 0;
    for (const doc of docs) {
      const { data: blob, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
      if (error || !blob) {
        console.error(`[WhatsApp Lead] Falha ao baixar ${doc.storage_path}:`, error?.message);
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (total + buffer.byteLength > MAX_ENRICH_TOTAL_BYTES && files.length > 0) continue;
      total += buffer.byteLength;
      files.push({ base64: buffer.toString("base64"), mimeType: doc.mime_type as string, index: files.length, documentId: doc.id });
    }
    if (files.length === 0) return;

    const { data: patient } = await admin.from("patients").select("clinic_id").eq("id", patientId).maybeSingle();
    const { data: insurers } = await admin
      .from("insurers")
      .select("id, name")
      .eq("clinic_id", patient?.clinic_id ?? DEV_CLINIC_ID);

    const outcome = await extractRegistrationFromFiles(
      files.map((f) => ({ base64: f.base64, mimeType: f.mimeType, index: f.index })),
      (insurers ?? []).map((i) => i.name),
    );
    if (!outcome.success) {
      console.error("[WhatsApp Lead] Extração falhou:", outcome.error);
      return;
    }

    const normalized = applyNormalization(outcome.result, insurers ?? []);
    const reclassify = normalized.documents
      .map((d) => ({ documentId: files[d.index]?.documentId, kind: coerceLeadKind(d.kind) }))
      .filter((r): r is { documentId: string; kind: LeadDocKind } => Boolean(r.documentId));

    const applied = await applyExtractionToLead(admin, patientId, normalized, reclassify);
    await insertAudit(admin, patientId, "lead_enriched", {
      fields: applied.filled,
      insurance_created: applied.insuranceCreated,
      reclassified: applied.reclassified,
      document_ids: signature,
    });
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em enrichLeadFromDocuments:", err);
  }
}

// ---------------------------------------------------------------------
// PDFs "a frio" (rascunhos já extraídos)
// ---------------------------------------------------------------------

/**
 * Promove um rascunho JÁ EXTRAÍDO (`registration_drafts.status='extracted'`,
 * ex.: PDF mandado a frio, fora do fluxo do bot) a lead: cria/reaproveita o
 * paciente-lead do telefone com a identidade extraída, copia os arquivos do
 * rascunho para `documents` e liga rascunho/arquivos ao paciente. NÃO muda
 * `status` — a recepção ainda confirma em /recepcao/pre-cadastros (a action de
 * validação trata arquivos com `document_id` só recategorizando).
 *
 * Em vez de reler tudo no Gemini, aplica a própria `extracted` do rascunho
 * (mesmo resultado de enrichLeadFromDocuments, sem segunda chamada paga).
 * Sem nome+nascimento extraídos (e sem lead prévio do telefone) devolve null:
 * o rascunho continua na fila.
 */
export async function promoteDraftToLead(draftId: string): Promise<{ patientId: string } | null> {
  try {
    const admin = createAdminClient();
    const { data: draft } = await admin
      .from("registration_drafts")
      .select("id, status, source_phone, extracted")
      .eq("id", draftId)
      .maybeSingle();
    if (!draft || draft.status !== "extracted" || !draft.source_phone) return null;

    const extraction = draft.extracted as DocumentExtraction | null;
    if (!extraction?.patient) return null;

    const lead = await upsertWhatsappLead({
      phone: draft.source_phone,
      childName: extraction.patient.full_name,
      childBirthDate: extraction.patient.birth_date,
      guardianName: extraction.guardian?.full_name,
      guardianCpf: extraction.guardian?.cpf,
      guardianEmail: extraction.guardian?.email,
    });
    if (!lead) return null;

    const { data: files } = await admin
      .from("registration_draft_files")
      .select("id, storage_path, mime_type, original_name, twilio_media_url, detected_type")
      .eq("draft_id", draftId)
      .is("document_id", null)
      .order("created_at", { ascending: true });

    for (const file of files ?? []) {
      const { data: blob, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(file.storage_path);
      if (error || !blob) {
        console.error(`[WhatsApp Lead] Falha ao baixar ${file.storage_path}:`, error?.message);
        continue;
      }
      const attached = await attachLeadDocument({
        patientId: lead.patientId,
        phone: draft.source_phone,
        buffer: Buffer.from(await blob.arrayBuffer()),
        kind: coerceLeadKind(file.detected_type),
        sourceKey: file.twilio_media_url || `draft-file:${file.id}`,
        originalName: file.original_name ?? undefined,
        contentTypeHint: file.mime_type,
      });
      if (!attached.ok) continue;
      await admin.from("registration_draft_files").update({ document_id: attached.documentId }).eq("id", file.id);
    }

    await admin.from("registration_drafts").update({ patient_id: lead.patientId, guardian_id: lead.guardianId }).eq("id", draftId);

    await applyExtractionToLead(admin, lead.patientId, extraction, []);

    return { patientId: lead.patientId };
  } catch (err) {
    console.error("[WhatsApp Lead] Exceção em promoteDraftToLead:", err);
    return null;
  }
}
