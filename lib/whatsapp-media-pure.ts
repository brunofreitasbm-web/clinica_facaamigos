// lib/whatsapp-media-pure.ts
// Decisões PURAS do recebimento de mídia (foto/PDF) por WhatsApp: se uma
// mensagem com anexo deve ser ingerida "a frio", como o resultado de salvar os
// anexos vira resposta/avanço de etapa no bot de anamnese e como se monta o
// ponteiro `storage://` gravado nas colunas `*_url` da anamnese. Sem nenhum
// import com alias `@/` para rodar em `node --test --experimental-strip-types`
// (tests/whatsapp-media-pure.test.ts).

export type MediaItem = { url: string; contentType?: string };

/** Bucket privado onde `lib/whatsapp-lead.ts` guarda os documentos. */
export const LEAD_DOCUMENTS_BUCKET = "clinic-documents";

/**
 * Ponteiro gravado em `anamnesis_scheduling_requests.laudo_pdf_url` & cia.
 * `/api/arquivos/anamnese/...` (lib/file-access.ts:parseStoredFileRef) o
 * converte em URL assinada de curta duração — o objeto nunca fica público.
 */
export function buildStoragePointer(storagePath: string): string {
  return `storage://${LEAD_DOCUMENTS_BUCKET}/${storagePath.replace(/^\/+/, "")}`;
}

export function isPdfPointer(pointer: string | null | undefined): boolean {
  return !!pointer && /\.pdf$/i.test(pointer.split(/[?#]/)[0]);
}

/**
 * Todos os anexos da mensagem; sem `media` (chamadores antigos, painel de
 * teste) cai no par `mediaUrl0`/`mediaContentType0`.
 */
export function collectMediaItems(params: {
  media?: MediaItem[];
  mediaUrl0?: string;
  mediaContentType0?: string;
}): MediaItem[] {
  const fromList = (params.media ?? []).filter((m) => !!m?.url);
  if (fromList.length > 0) return fromList;
  if (params.mediaUrl0) return [{ url: params.mediaUrl0, contentType: params.mediaContentType0 || undefined }];
  return [];
}

// ---------------------------------------------------------------------
// Mídia "a frio"
// ---------------------------------------------------------------------

/**
 * Só foto/PDF (ou tipo não informado — o conteúdo real é conferido depois
 * pelos magic bytes) entra na ingestão a frio. Áudio/vídeo/contato seguem o
 * fluxo normal (recepção, FAQ) em vez de virar "documento não suportado".
 */
export function filterIngestibleMedia(media: MediaItem[]): MediaItem[] {
  return media.filter((m) => {
    const type = (m.contentType ?? "").split(";")[0].trim().toLowerCase();
    return !type || type.startsWith("image/") || type === "application/pdf" || type === "application/octet-stream";
  });
}

/**
 * Mensagem que é só áudio (nota de voz do WhatsApp) — nenhum bot transcreve
 * áudio, e antes ela caía no FAQ com `body` vazio e morria em silêncio, sem a
 * família saber que ninguém ia ouvir. Detecta por `contentType` (audio/ogg,
 * audio/mpeg...); uma legenda de texto junto conta como mensagem escrita e
 * segue o fluxo normal.
 */
export function isAudioOnlyMessage(media: MediaItem[], body: string): boolean {
  if (body.trim().length > 0) return false;
  if (media.length === 0) return false;
  return media.every((m) => (m.contentType ?? "").split(";")[0].trim().toLowerCase().startsWith("audio/"));
}

export type ColdMediaPlan =
  | { action: "skip" }
  | {
      action: "ingest";
      /** Conversa com humano: ingere sem responder. */
      silent: boolean;
      /** `patient` = responsável já cadastrado (anexa direto); `draft` = telefone desconhecido (rascunho + IA). */
      target: "patient" | "draft";
    };

/**
 * Mensagem com mídia que NENHUM outro bot está esperando (as etapas em que o
 * anexo é esperado — anamnese/acolhimento — são tratadas antes e chegam aqui
 * com `awaitingAttachmentDirectly`). Não depende de fluxo de agendamento, de
 * palavra-gatilho nem de `is_bot_active`: todo documento mandado à clínica
 * precisa ser guardado.
 */
export function planColdMedia(input: {
  mediaCount: number;
  awaitingAttachmentDirectly: boolean;
  botActive: boolean;
  knownPatient: boolean;
}): ColdMediaPlan {
  if (input.mediaCount <= 0 || input.awaitingAttachmentDirectly) return { action: "skip" };
  return { action: "ingest", silent: !input.botActive, target: input.knownPatient ? "patient" : "draft" };
}

// ---------------------------------------------------------------------
// Resultado de salvar os anexos
// ---------------------------------------------------------------------

export type MediaSaveCounts = {
  saved: number;
  duplicates: number;
  unsupported: number;
  failed: number;
  /** Arquivos pendentes antigos adotados nesta chamada (vêm ANTES dos desta mensagem em `storagePaths`). */
  adopted: number;
  storagePaths: string[];
};

export type MediaSaveSummary =
  | { status: "saved"; pointers: string[]; unsupportedNote: boolean }
  | { status: "unsupported" }
  | { status: "retry" };

/**
 * `saved+duplicates === 0` NUNCA avança etapa: `unsupported` (formato que não
 * lemos) e `retry` (falha técnica/vazio) pedem o reenvio. Os ponteiros só
 * incluem os arquivos DESTA mensagem (descarta os pendentes adotados, que
 * `registerLeadMedia` põe na frente da lista).
 */
export function summarizeMediaSave(counts: MediaSaveCounts): MediaSaveSummary {
  if (counts.saved + counts.duplicates === 0) {
    return counts.unsupported > 0 ? { status: "unsupported" } : { status: "retry" };
  }
  const own = counts.storagePaths.slice(Math.max(0, counts.adopted));
  const pointers = (own.length > 0 ? own : counts.storagePaths).map(buildStoragePointer);
  return { status: "saved", pointers, unsupportedNote: counts.unsupported > 0 };
}

/** Resposta única para nota de voz: a clínica não ouve áudios neste canal. */
export const AUDIO_NOT_SUPPORTED_REPLY =
  "Por aqui não conseguimos ouvir mensagens de áudio 🎧🙏 Pode escrever sua dúvida em texto, por favor? " +
  "Assim conseguimos te responder bem mais rápido. 💙";

export const UNSUPPORTED_MEDIA_REPLY =
  "Só conseguimos ler fotos (JPG/PNG) e PDF. 🙏 Pode reenviar nesse formato?";
export const RETRY_MEDIA_REPLY =
  "Não conseguimos salvar o arquivo agora. 😕 Reenvie a foto ou o PDF (até 25MB) por aqui, por favor.";
export const PARTIAL_UNSUPPORTED_NOTE =
  "\n\n(Algum arquivo não pôde ser lido — só aceitamos fotos JPG/PNG e PDF.)";

/**
 * Carteirinha (frente): decide para onde vai a etapa seguinte.
 * - PDF único cobre frente e verso;
 * - duas ou mais fotos na mesma mensagem = frente + verso;
 * - uma foto só → falta o verso.
 */
export function splitCardPointers(pointers: string[]): { front: string; back: string | null } {
  const front = pointers[0];
  if (isPdfPointer(front)) return { front, back: front };
  if (pointers.length >= 2) return { front, back: pointers[1] };
  return { front, back: null };
}

// ---------------------------------------------------------------------
// Respostas da mídia a frio
// ---------------------------------------------------------------------

/** Resposta quando o anexo foi direto para o cadastro de um responsável já conhecido. */
export function coldPatientReply(counts: Pick<MediaSaveCounts, "saved" | "duplicates" | "unsupported">): string {
  if (counts.saved + counts.duplicates > 0) {
    return (
      "Recebido! 📄 Já anexamos ao cadastro da família e a recepção vai conferir. " +
      "Se tiver mais algum documento, é só enviar por aqui. 💙" +
      (counts.unsupported > 0 ? PARTIAL_UNSUPPORTED_NOTE : "")
    );
  }
  return counts.unsupported > 0 ? UNSUPPORTED_MEDIA_REPLY : RETRY_MEDIA_REPLY;
}
