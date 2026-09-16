import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Fallback de TODAS as telas de /supervisao — a subárvore inteira não tinha
 * nenhum loading.tsx (só herdava o fallback genérico de app/loading.tsx),
 * então qualquer navegação dentro do módulo travava a tela até a query
 * resolver em vez de mostrar feedback imediato. `fill={false}` porque
 * SupervisaoHeader já vive em app/supervisao/layout.tsx.
 */
export default function SupervisaoLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando dados atualizados da coordenação" />;
}
