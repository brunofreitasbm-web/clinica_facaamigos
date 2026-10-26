import { DraftReviewBody, draftReviewDescription, loadDraftReview } from "../../../pre-cadastros/[draftId]/draft-review-body";
import { DraftModalShell } from "./draft-modal-shell";

export const dynamic = "force-dynamic";

/**
 * "Conferir e cadastrar" como janela flutuante: navegação por Link dentro de
 * /recepcao é interceptada aqui e a conferência abre por cima da tela atual.
 * Abrir a URL direto (ou F5) cai na página cheia em pre-cadastros/[draftId].
 */
export default async function DraftReviewModalPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const data = await loadDraftReview(draftId);

  return (
    <DraftModalShell title={data.currentPatient?.full_name ?? "Pré-cadastro"} description={draftReviewDescription(data.draft)}>
      <DraftReviewBody data={data} />
    </DraftModalShell>
  );
}
