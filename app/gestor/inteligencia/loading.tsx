import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function InteligenciaLoading() {
  return (
    <>
      <GestorNav active="inteligencia" />
      <ModuleSkeleton title="Inteligência BI" subtitle="Processando indicadores de receita, glosas e desempenho" />
    </>
  );
}
