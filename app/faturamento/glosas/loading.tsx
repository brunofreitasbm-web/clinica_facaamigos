import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Só o módulo raiz de /faturamento tinha loading.tsx; a tela de Glosas
 * (357 linhas, análise de remessa) ficava sem feedback próprio ao navegar
 * direto pra ela. `fill={false}` — FaturamentoHeader já vive no layout.
 */
export default function GlosasLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando glosas do faturamento" />;
}
