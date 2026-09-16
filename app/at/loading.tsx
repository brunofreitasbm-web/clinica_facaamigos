import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Módulo de Acompanhamento Terapêutico (AT) não tinha nenhum loading.tsx —
 * toda navegação dentro dele ficava sem feedback próprio.
 */
export default function AtLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando dados do Acompanhamento Terapêutico" />;
}
