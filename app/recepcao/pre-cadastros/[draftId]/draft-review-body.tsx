import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import type { DocumentExtraction } from "@/lib/document-extraction";
import { claimAndProcessDrafts } from "@/lib/registration-drafts-process";
import { DraftReviewForm } from "./draft-review-form";
import { DraftProcessingPoller } from "./draft-processing-poller";

const DRAFT_COLUMNS =
  "id, source, source_phone, status, patient_id, guardian_id, extracted, warnings, reject_reason, error, authorized_guide, authorization_id";

/**
 * Carrega o pré-cadastro e tudo que a conferência precisa. Compartilhado pela
 * página cheia (/recepcao/pre-cadastros/[id]) e pela janela flutuante
 * (rota interceptada em @modal), para as duas mostrarem exatamente o mesmo.
 */
export async function loadDraftReview(draftId: string) {
  const supabase = await createClient();

  let { data: draft } = await supabase.from("registration_drafts").select(DRAFT_COLUMNS).eq("id", draftId).maybeSingle();
  if (!draft) notFound();

  // Se o rascunho estiver pendente ao abrir, dispara o processamento da IA imediatamente.
  if (draft.status === "pending") {
    try {
      await claimAndProcessDrafts({ draftId: draft.id });
      const { data: updatedDraft } = await supabase.from("registration_drafts").select(DRAFT_COLUMNS).eq("id", draftId).maybeSingle();
      if (updatedDraft) draft = updatedDraft;
    } catch (err) {
      console.error("[DraftReviewPage] Erro ao disparar processamento inicial:", err);
    }
  }

  const { data: files } = await supabase
    .from("registration_draft_files")
    .select("id, original_name, mime_type, detected_type")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true });

  const { data: insurers } = await supabase.from("insurers").select("id, name").order("name");

  let currentPatient: { full_name: string; birth_date: string } | null = null;
  if (draft.patient_id) {
    await logRecordAccess(supabase, draft.patient_id, "cadastro_assistido_ia");
    const { data } = await supabase.from("patients").select("full_name, birth_date").eq("id", draft.patient_id).maybeSingle();
    currentPatient = data ?? null;
  }

  // Possível duplicata: pré-cadastro (número novo) cujo nome+nascimento
  // extraído bate com um paciente já existente — evita cadastrar a mesma
  // criança duas vezes quando ela já tinha ficha e só o telefone é novo.
  let duplicateCandidates: { id: string; full_name: string; birth_date: string }[] = [];
  let extracted = draft.extracted as DocumentExtraction | null;
  // A guia que o plano autorizou (etapa 3 da fila de pendências) vale mais que a
  // leitura da IA: pré-preenche o bloco de guia com ela.
  const authorizedGuide = draft.authorized_guide as Partial<DocumentExtraction["authorization"]> | null;
  if (extracted && authorizedGuide) {
    extracted = { ...extracted, authorization: { ...extracted.authorization, ...authorizedGuide } };
  }
  if (!draft.patient_id && extracted?.patient?.full_name) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, birth_date")
      .ilike("full_name", `%${extracted.patient.full_name}%`)
      .limit(5);
    duplicateCandidates = data ?? [];
  }

  return { draft, files: files ?? [], insurers: insurers ?? [], currentPatient, duplicateCandidates, extracted };
}

export type DraftReviewData = Awaited<ReturnType<typeof loadDraftReview>>;

export function draftReviewDescription(draft: DraftReviewData["draft"]): string {
  return draft.source === "whatsapp"
    ? `Documentos recebidos por WhatsApp${draft.source_phone ? ` (${draft.source_phone})` : ""}. Confira os dados extraídos antes de confirmar.`
    : "Documentos enviados pelo portal da família. Confira os dados extraídos antes de confirmar.";
}

export function DraftReviewBody({ data }: { data: DraftReviewData }) {
  const { draft, files, insurers, duplicateCandidates, extracted } = data;

  if (draft.status === "pending" || draft.status === "processing") {
    return <DraftProcessingPoller draftId={draft.id} status={draft.status} />;
  }
  if (draft.status === "validated") {
    return <p className="text-sm text-ink-faint">Este rascunho já foi validado.</p>;
  }
  if (draft.status === "rejected") {
    if (draft.reject_reason?.startsWith("Mesclado com rascunho ")) {
      return (
        <div className="rounded-lg border border-paper-line bg-paper-surface p-5">
          <p className="m-0 text-base text-ink">Este rascunho foi unificado com outro pré-cadastro do mesmo paciente.</p>
          <Link
            href={`/recepcao/pre-cadastros/${draft.reject_reason.replace("Mesclado com rascunho ", "").trim()}`}
            className="btn btn-primary mt-3 inline-block no-underline"
          >
            Abrir pré-cadastro unificado →
          </Link>
        </div>
      );
    }
    return <p className="text-sm text-ink-faint">Este rascunho foi rejeitado{draft.reject_reason ? `: ${draft.reject_reason}` : "."}</p>;
  }
  return (
    <DraftReviewForm
      draftId={draft.id}
      status={draft.status}
      extracted={extracted}
      warnings={draft.warnings ?? []}
      error={draft.error}
      files={files}
      insurers={insurers}
      hasPatient={Boolean(draft.patient_id)}
      duplicateCandidates={duplicateCandidates}
    />
  );
}
