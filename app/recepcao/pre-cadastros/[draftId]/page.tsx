import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logRecordAccess } from "@/lib/record-access-log";
import type { DocumentExtraction } from "@/lib/document-extraction";
import { DraftReviewForm } from "./draft-review-form";

export const dynamic = "force-dynamic";

export default async function DraftReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const supabase = await createClient();

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, source, source_phone, status, patient_id, guardian_id, extracted, warnings, reject_reason, error")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) notFound();

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
  const extracted = draft.extracted as DocumentExtraction | null;
  if (!draft.patient_id && extracted?.patient.full_name) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, birth_date")
      .ilike("full_name", `%${extracted.patient.full_name}%`)
      .limit(5);
    duplicateCandidates = data ?? [];
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title={currentPatient?.full_name ?? "Pré-cadastro"}
        description={
          draft.source === "whatsapp"
            ? `Documentos recebidos por WhatsApp${draft.source_phone ? ` (${draft.source_phone})` : ""}. Confira os dados extraídos antes de confirmar.`
            : "Documentos enviados pelo portal da família. Confira os dados extraídos antes de confirmar."
        }
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <Link href="/recepcao/pre-cadastros" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Cadastro assistido por IA
        </Link>

        {draft.status === "pending" || draft.status === "processing" ? (
          <p className="text-sm text-ink-faint">A IA ainda está lendo os documentos. Atualize a página em instantes.</p>
        ) : draft.status === "validated" ? (
          <p className="text-sm text-ink-faint">Este rascunho já foi validado.</p>
        ) : draft.status === "rejected" ? (
          <p className="text-sm text-ink-faint">Este rascunho foi rejeitado{draft.reject_reason ? `: ${draft.reject_reason}` : "."}</p>
        ) : (
          <DraftReviewForm
            draftId={draft.id}
            status={draft.status}
            extracted={extracted}
            warnings={draft.warnings ?? []}
            error={draft.error}
            files={files ?? []}
            insurers={insurers ?? []}
            hasPatient={Boolean(draft.patient_id)}
            duplicateCandidates={duplicateCandidates}
          />
        )}
      </div>
    </main>
  );
}
