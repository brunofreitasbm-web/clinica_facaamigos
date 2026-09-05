import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function MetasLoading() {
  return (
    <>
      <GestorNav active="metas" />
      <ModuleSkeleton title="Metas por Cargo" subtitle="Carregando metas operacionais e clínicas" />
    </>
  );
}
