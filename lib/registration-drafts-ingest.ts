// lib/registration-drafts-ingest.ts
// "Cadastro assistido por IA" — ponto de entrada dos dois canais (WhatsApp e
// portal da família) que alimentam a mesma fila de rascunhos
// (`registration_drafts`/`registration_draft_files`). Este módulo só baixa e
// guarda arquivos — a extração de verdade (chamada ao Gemini) acontece
// depois, via cron (lib/registration-drafts-process.ts), pra não segurar a
// resposta do webhook do Twilio além dos ~15s que a Twilio tolera.
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { formatE164Phone, resolvePatientFromPhone } from "@/lib/twilio";

const DOCUMENTS_BUCKET = "clinic-documents";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const OPEN_DRAFT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h — agrupa fotos mandadas aos poucos numa mesma remessa
const MAX_FILES_PER_DRAFT = 10;

// Reaproveitado por lib/twilio-intake-bot.ts (acolhimento de plano de saúde)
// — mesmo conjunto de mídia aceita, mesmo bucket privado.
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo";
}

export function extensionFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

/**
 * Baixa uma mídia do Twilio (URL temporária, exige Basic Auth com as
 * credenciais da conta) — mesmo mecanismo de
 * lib/twilio-anamnesis-bot.ts:uploadTwilioMediaToStorage, mas devolvendo o
 * buffer em memória em vez de já subir pro Storage (aqui o destino é sempre
 * o bucket privado `clinic-documents`, nunca o `patient-documents` público
 * usado por aquele fluxo).
 */
export async function downloadTwilioMedia(url: string, contentTypeHint?: string): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const headers: Record<string, string> = {};
    if (accountSid && authToken) {
      headers["Authorization"] = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[Registration Draft] Falha ao baixar mídia Twilio: ${res.status} ${res.statusText}`);
      return null;
    }

    const mime = (contentTypeHint || res.headers.get("content-type") || "").split(";")[0].trim();
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
      console.error(`[Registration Draft] Mídia acima do limite de ${MAX_FILE_BYTES} bytes.`);
      return null;
    }

    return { buffer: Buffer.from(arrayBuffer), mime };
  } catch (err) {
    console.error("[Registration Draft] Exceção ao baixar mídia Twilio:", err);
    return null;
  }
}

type OpenDraftLookup = { phone?: string; patientId?: string };

/**
 * Reaproveita um rascunho ainda aberto (não validado/rejeitado) da mesma
 * origem — WhatsApp identifica pelo telefone, portal pelo paciente — desde
 * que a última mídia tenha chegado há menos de 2h. Fora dessa janela, um
 * rascunho novo é criado (evita misturar duas remessas separadas no tempo).
 */
async function findOpenDraft(
  admin: ReturnType<typeof createAdminClient>,
  source: "whatsapp" | "portal",
  lookup: OpenDraftLookup,
): Promise<{ id: string; files_count: number } | null> {
  const cutoffIso = new Date(Date.now() - OPEN_DRAFT_WINDOW_MS).toISOString();
  let query = admin
    .from("registration_drafts")
    .select("id, registration_draft_files(count)")
    .eq("source", source)
    .in("status", ["pending", "processing", "extracted"])
    .gte("last_file_at", cutoffIso)
    .order("last_file_at", { ascending: false })
    .limit(1);

  query = lookup.phone ? query.eq("source_phone", lookup.phone) : query.eq("patient_id", lookup.patientId ?? "");

  const { data } = await query.maybeSingle();
  if (!data) return null;
  const filesCount = Array.isArray(data.registration_draft_files)
    ? (data.registration_draft_files[0] as { count: number } | undefined)?.count ?? 0
    : 0;
  return { id: data.id, files_count: filesCount };
}

export type WhatsappIngestResult = { replyMessage: string };

/**
 * Recebe as mídias de uma mensagem do WhatsApp, baixa cada uma e anexa (ou
 * cria) o rascunho do telefone remetente. Nunca lança — falha de download
 * vira mensagem de erro pro usuário, sem derrubar o webhook.
 */
export async function ingestWhatsappMedia(params: {
  from: string;
  media: { url: string; contentType?: string }[];
  body?: string;
}): Promise<WhatsappIngestResult> {
  const phone = formatE164Phone(params.from.replace("whatsapp:", ""));
  const admin = createAdminClient();

  const resolved = await resolvePatientFromPhone(phone);

  const open = await findOpenDraft(admin, "whatsapp", { phone });
  let draftId = open?.id ?? null;
  const existingFileCount = open?.files_count ?? 0;

  if (!draftId) {
    const { data: created, error } = await admin
      .from("registration_drafts")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        patient_id: resolved?.patientId ?? null,
        guardian_id: resolved?.guardianId ?? null,
        source: "whatsapp",
        source_phone: phone,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !created) {
      console.error("[Registration Draft] Falha ao criar rascunho:", error?.message);
      return { replyMessage: "Não conseguimos salvar o arquivo agora. Tente enviar de novo em alguns minutos." };
    }
    draftId = created.id;
  }

  if (existingFileCount >= MAX_FILES_PER_DRAFT) {
    return {
      replyMessage:
        "Já recebemos documentos suficientes nesta conversa. 🙏 A recepção vai conferir tudo em breve — se precisar enviar mais algum, aguarde a confirmação do cadastro.",
    };
  }

  let savedCount = 0;
  let sawUnsupported = false;
  let sawDownloadFailure = false;

  for (const item of params.media) {
    if (existingFileCount + savedCount >= MAX_FILES_PER_DRAFT) break;

    const downloaded = await downloadTwilioMedia(item.url, item.contentType);
    if (!downloaded) {
      sawDownloadFailure = true;
      continue;
    }
    if (!ALLOWED_MIME_TYPES.has(downloaded.mime)) {
      sawUnsupported = true;
      continue;
    }

    const fileIndex = existingFileCount + savedCount;
    const fileName = `${fileIndex}-${Date.now()}.${extensionFor(downloaded.mime)}`;
    const storagePath = `drafts/${draftId}/${fileName}`;

    const { error: uploadError } = await admin.storage.from(DOCUMENTS_BUCKET).upload(storagePath, downloaded.buffer, {
      contentType: downloaded.mime,
      upsert: false,
    });
    if (uploadError) {
      console.error("[Registration Draft] Falha ao subir arquivo:", uploadError.message);
      sawDownloadFailure = true;
      continue;
    }

    await admin.from("registration_draft_files").insert({
      draft_id: draftId,
      storage_path: storagePath,
      mime_type: downloaded.mime,
      size_bytes: downloaded.buffer.byteLength,
      original_name: sanitizeFileName(fileName),
      twilio_media_url: item.url,
    });
    savedCount++;
  }

  if (savedCount === 0) {
    if (sawUnsupported) {
      return { replyMessage: "Só conseguimos ler fotos (JPG/PNG) e PDF. Pode reenviar nesse formato?" };
    }
    if (sawDownloadFailure) {
      return { replyMessage: "Não conseguimos salvar o arquivo agora. Tente enviar de novo em alguns minutos." };
    }
    return { replyMessage: "Não identificamos nenhum arquivo válido na mensagem." };
  }

  const guardianNote = (params.body || "").trim();
  await admin
    .from("registration_drafts")
    .update({
      last_file_at: new Date().toISOString(),
      status: "pending",
      attempts: 0,
      extracted: null,
      ...(guardianNote ? { guardian_message: guardianNote } : {}),
    })
    .eq("id", draftId);

  const totalFiles = existingFileCount + savedCount;
  if (existingFileCount === 0) {
    const base =
      "Recebemos 1 documento! 📄 Pode mandar os outros (certidão, RG/CPF, comprovante de residência, carteirinha, guia e laudo) nesta mesma conversa. A recepção vai conferir tudo e te avisa quando o cadastro estiver pronto.";
    const knownPatientNote = resolved
      ? ""
      : "\n\nComo este número ainda não está no nosso cadastro, se puder, mande também o *nome completo da criança* e o *seu nome* numa mensagem.";
    return { replyMessage: `${base}${knownPatientNote}` };
  }

  return { replyMessage: `Recebido! Já são *${totalFiles} documentos* nesta conversa. 👍 Quando terminar, é só aguardar — a recepção confere e te avisa.` };
}

/**
 * Anexa um upload já feito pelo portal da família (app/familia/actions.ts,
 * uploadFamilyDocument) a um rascunho de cadastro assistido. Diferente do
 * WhatsApp, o arquivo já está no Storage (categoria 'familia_envio') — aqui
 * só registramos a referência (`document_id`), sem duplicar bytes; na
 * validação, esse arquivo apenas troca de categoria em vez de ser movido.
 */
export async function attachPortalUploadToDraft(params: {
  patientId: string;
  submittedBy: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  documentId: string;
}): Promise<{ draftId: string } | null> {
  try {
    const admin = createAdminClient();

    const open = await findOpenDraft(admin, "portal", { patientId: params.patientId });
    let draftId = open?.id ?? null;

    if (!draftId) {
      const { data: patient } = await admin.from("patients").select("clinic_id").eq("id", params.patientId).maybeSingle();
      const { data: created, error } = await admin
        .from("registration_drafts")
        .insert({
          clinic_id: patient?.clinic_id ?? DEV_CLINIC_ID,
          patient_id: params.patientId,
          source: "portal",
          submitted_by: params.submittedBy,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !created) {
        console.error("[Registration Draft] Falha ao criar rascunho do portal:", error?.message);
        return null;
      }
      draftId = created.id;
    }

    await admin.from("registration_draft_files").insert({
      draft_id: draftId,
      storage_path: params.storagePath,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
      original_name: sanitizeFileName(params.originalName),
      document_id: params.documentId,
    });

    await admin
      .from("registration_drafts")
      .update({ last_file_at: new Date().toISOString(), status: "pending", attempts: 0, extracted: null })
      .eq("id", draftId);

    return { draftId };
  } catch (err) {
    console.error("[Registration Draft] Exceção ao anexar upload do portal:", err);
    return null;
  }
}
