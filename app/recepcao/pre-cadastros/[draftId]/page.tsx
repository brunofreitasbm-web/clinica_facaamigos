import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { DraftReviewBody, draftReviewDescription, loadDraftReview } from "./draft-review-body";

export const dynamic = "force-dynamic";

export default async function DraftReviewPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const data = await loadDraftReview(draftId);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title={data.currentPatient?.full_name ?? "Pré-cadastro"}
        description={draftReviewDescription(data.draft)}
      />
      <PageContainer>
        <Link href="/recepcao/pacientes/pendencias" className="text-[13px] font-semibold no-underline" style={{ color: "var(--color-accent)" }}>
          ← Fila de pendências
        </Link>
        <DraftReviewBody data={data} />
      </PageContainer>
    </main>
  );
}
