import { AnamnesePanel } from "@/components/anamnese-panel";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function AnamneseTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex flex-1 flex-col">
      <PageContainer>
        <AnamnesePanel
          patientId={id}
          returnHref={`/gestor/pacientes/${id}/cadastro`}
          tcleHref={`/supervisao/pacientes/${id}/anamnese/tcle`}
        />
      </PageContainer>
    </main>
  );
}
