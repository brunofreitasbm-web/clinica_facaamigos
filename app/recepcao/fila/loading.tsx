import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";

/**
 * Esqueleto com o MESMO formato da tela (abas, lista e detalhe). O da rota de Autorizações desenhava 4 cartões
 * de métricas e uma tabela que a tela não tem, e a página "pulava" ao carregar.
 */
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col" aria-busy="true">
      <PageHeader axisLabel="Recepção" title="Fila de entrada" />
      <PageContainer className="gap-4">
        <div role="status" aria-label="Carregando a fila" className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-12 w-44 rounded-xl" />
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <div className="skeleton-shimmer h-[420px] min-w-0 flex-[1_1_340px] rounded-2xl" />
            <div className="skeleton-shimmer h-[520px] min-w-0 flex-[999_1_560px] rounded-2xl" />
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
