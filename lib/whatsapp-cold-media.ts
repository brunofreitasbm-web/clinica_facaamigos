// lib/whatsapp-cold-media.ts
// Mídia (foto/PDF) que chega por WhatsApp SEM nenhum bot esperando o anexo — o
// caso típico é a família mandar o laudo "do nada". Antes só era guardada se o
// telefone já estivesse no fluxo de agendamento; agora TODA mídia é guardada:
// - responsável já cadastrado → anexa direto ao paciente (aba Documentos);
// - telefone desconhecido → rascunho (`registration_drafts`) e extração por IA
//   imediata em segundo plano; ao terminar, o rascunho vira lead
//   (promoteDraftToLead, chamado por registration-drafts-process.ts).
// A decisão (ingerir? em silêncio? para onde?) é pura, em whatsapp-media-pure.ts.
import { runAfterResponse } from "@/lib/after-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimAndProcessDrafts } from "@/lib/registration-drafts-process";
import { ingestWhatsappMedia } from "@/lib/registration-drafts-ingest";
import { enrichLeadFromDocuments, registerLeadMedia } from "@/lib/whatsapp-lead";
import { coldPatientReply, filterIngestibleMedia, planColdMedia, type MediaItem } from "@/lib/whatsapp-media-pure";

// Fotos de uma mesma remessa chegam em webhooks separados: cada um agenda a
// extração, mas só o que ainda enxerga o `last_file_at` da própria remessa
// roda — os demais cedem para a última foto, que extrai com todos os arquivos.
const EXTRACTION_DEBOUNCE_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function extractDraftWhenBatchSettles(draftId: string, lastFileAt: string): Promise<void> {
  await sleep(EXTRACTION_DEBOUNCE_MS);
  const admin = createAdminClient();
  const { data: draft } = await admin
    .from("registration_drafts")
    .select("last_file_at")
    .eq("id", draftId)
    .maybeSingle();
  // Chegou arquivo mais novo: o webhook dele fará a extração com todos.
  if (!draft?.last_file_at || new Date(draft.last_file_at).getTime() > new Date(lastFileAt).getTime()) return;
  await claimAndProcessDrafts({ draftId });
}

/**
 * @returns `null` quando a mensagem não é caso de mídia a frio (o chamador
 * segue o fluxo normal); senão a resposta ("" = silêncio, conversa com humano).
 */
export async function handleColdWhatsappMedia(params: {
  from: string;
  body: string;
  media: MediaItem[];
  botActive: boolean;
  awaitingAttachmentDirectly: boolean;
  knownPatient: boolean;
}): Promise<{ replyMessage: string } | null> {
  const media = filterIngestibleMedia(params.media);
  const plan = planColdMedia({
    mediaCount: media.length,
    awaitingAttachmentDirectly: params.awaitingAttachmentDirectly,
    botActive: params.botActive,
    knownPatient: params.knownPatient,
  });
  if (plan.action === "skip") return null;

  if (plan.target === "patient") {
    const result = await registerLeadMedia({ identity: { phone: params.from }, media, kind: "outro" });
    const patientId = result.patientId;
    if (patientId && (result.saved > 0 || result.adopted > 0)) {
      // `enrichLeadFromDocuments` reclassifica ("outro" → laudo/guia/...) e completa campos em branco.
      runAfterResponse("enriquecer lead (mídia a frio)", () => enrichLeadFromDocuments(patientId));
    }
    return { replyMessage: plan.silent ? "" : coldPatientReply(result) };
  }

  const ingest = await ingestWhatsappMedia({ from: params.from, media, body: params.body });
  if (ingest.draftId && ingest.lastFileAt && (ingest.savedCount ?? 0) > 0) {
    const { draftId, lastFileAt } = ingest;
    runAfterResponse("extração imediata do rascunho", () => extractDraftWhenBatchSettles(draftId, lastFileAt));
  }
  return { replyMessage: plan.silent ? "" : ingest.replyMessage };
}
