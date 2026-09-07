// lib/registration-drafts-process.ts
// Executa a extração de verdade (chamada ao Gemini) sobre um rascunho de
// "cadastro assistido por IA": baixa os arquivos do Storage, chama
// extractRegistrationFromFiles e normaliza o resultado. Reivindicação
// atômica via a função SQL `claim_registration_drafts` (migration
// 20260907000001) evita que duas execuções do cron processem o mesmo
// rascunho ao mesmo tempo. Usado por app/api/extractions/process/route.ts
// (cron, em lote) e por app/recepcao/pre-cadastros/actions.ts
// (reprocessDraft, um rascunho específico).
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRegistrationFromFiles, applyNormalization } from "@/lib/document-extraction";

const DOCUMENTS_BUCKET = "clinic-documents";
// Teto prático de payload inline pro Gemini (base64 de 25MB de arquivos vira
// ~33MB de JSON) — soma dos arquivos originais antes de virar base64.
const MAX_TOTAL_INLINE_BYTES = 18 * 1024 * 1024;

export type ProcessDraftOutcome = { draftId: string; status: "extracted" | "failed"; error?: string };

async function downloadFileAsBase64(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
): Promise<{ base64: string; sizeBytes: number } | null> {
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).download(storagePath);
  if (error || !data) {
    console.error(`[Registration Draft] Falha ao baixar ${storagePath}:`, error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString("base64"), sizeBytes: buffer.byteLength };
}

/**
 * Processa um rascunho já reivindicado (status='processing'). Sempre grava
 * um resultado final ('extracted' com o JSON normalizado, ou 'failed' com
 * `error`) — nunca deixa o rascunho preso em 'processing' nem fabrica um
 * resultado de sucesso quando a extração falhou.
 */
async function runExtractionForDraft(
  admin: ReturnType<typeof createAdminClient>,
  draft: { id: string; clinic_id: string; guardian_message: string | null },
): Promise<ProcessDraftOutcome> {
  const { data: files } = await admin
    .from("registration_draft_files")
    .select("id, storage_path, mime_type, size_bytes")
    .eq("draft_id", draft.id)
    .order("created_at", { ascending: true });

  if (!files || files.length === 0) {
    await admin.from("registration_drafts").update({ status: "failed", error: "Rascunho sem arquivos." }).eq("id", draft.id);
    return { draftId: draft.id, status: "failed", error: "Rascunho sem arquivos." };
  }

  // Corta os maiores arquivos se a soma passar do teto inline — melhor
  // extrair parcialmente (com aviso) do que falhar tudo.
  const sorted = [...files].sort((a, b) => (a.size_bytes ?? 0) - (b.size_bytes ?? 0));
  let runningTotal = 0;
  const included: typeof sorted = [];
  const skipped: typeof sorted = [];
  for (const f of sorted) {
    const size = f.size_bytes ?? 0;
    if (runningTotal + size > MAX_TOTAL_INLINE_BYTES && included.length > 0) {
      skipped.push(f);
      continue;
    }
    runningTotal += size;
    included.push(f);
  }

  const downloaded: { base64: string; mimeType: string; index: number }[] = [];
  for (let i = 0; i < included.length; i++) {
    const dl = await downloadFileAsBase64(admin, included[i].storage_path);
    if (!dl) {
      skipped.push(included[i]);
      continue;
    }
    downloaded.push({ base64: dl.base64, mimeType: included[i].mime_type, index: downloaded.length });
  }

  if (downloaded.length === 0) {
    const error = "Não foi possível baixar nenhum dos arquivos do rascunho.";
    await admin.from("registration_drafts").update({ status: "failed", error }).eq("id", draft.id);
    return { draftId: draft.id, status: "failed", error };
  }

  const { data: insurers } = await admin.from("insurers").select("id, name").eq("clinic_id", draft.clinic_id);

  const outcome = await extractRegistrationFromFiles(
    downloaded.map((d) => ({ base64: d.base64, mimeType: d.mimeType, index: d.index })),
    (insurers ?? []).map((i) => i.name),
    { guardianMessage: draft.guardian_message ?? undefined },
  );

  if (!outcome.success) {
    await admin.from("registration_drafts").update({ status: "failed", error: outcome.error }).eq("id", draft.id);
    return { draftId: draft.id, status: "failed", error: outcome.error };
  }

  const normalized = applyNormalization(outcome.result, insurers ?? []);
  if (skipped.length > 0) {
    normalized.warnings.push(
      `${skipped.length} arquivo(s) não foram enviados à IA (tamanho ou falha de download) — confira manualmente.`,
    );
  }

  await admin
    .from("registration_drafts")
    .update({
      status: "extracted",
      extracted: normalized,
      fields_confidence: normalized.confidence,
      warnings: normalized.warnings,
      model: outcome.model,
      error: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  // Guarda o tipo de documento sugerido em cada arquivo, pra a UI de
  // validação já pré-selecionar a categoria.
  for (const doc of normalized.documents) {
    const file = included[doc.index];
    if (file) {
      await admin.from("registration_draft_files").update({ detected_type: doc.kind }).eq("id", file.id);
    }
  }

  await admin.from("audit_log").insert({
    table_name: "registration_drafts",
    row_id: draft.id,
    action: "draft_extracted",
    clinic_id: draft.clinic_id,
    after: { warnings: normalized.warnings.length, files: downloaded.length },
  });

  return { draftId: draft.id, status: "extracted" };
}

/**
 * Reivindica (via `claim_registration_drafts`) e processa até `limit`
 * rascunhos elegíveis, ou um `draftId` específico (reprocessamento manual —
 * ignora a janela de 90s/tentativas usada pelo cron). Chamado tanto pela
 * rota do cron quanto pela action "Reprocessar" da tela de validação.
 */
export async function claimAndProcessDrafts(opts: { limit?: number; draftId?: string } = {}): Promise<ProcessDraftOutcome[]> {
  const admin = createAdminClient();

  const { data: claimed, error } = await admin.rpc("claim_registration_drafts", {
    p_limit: opts.draftId ? 1 : (opts.limit ?? 3),
    p_draft_id: opts.draftId,
  });

  if (error) {
    console.error("[Registration Draft] Falha ao reivindicar rascunhos:", error.message);
    return [];
  }
  if (!claimed || claimed.length === 0) return [];

  const results: ProcessDraftOutcome[] = [];
  for (const draft of claimed) {
    results.push(
      await runExtractionForDraft(admin, {
        id: draft.id,
        clinic_id: draft.clinic_id,
        guardian_message: draft.guardian_message,
      }),
    );
  }
  return results;
}
