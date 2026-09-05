import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function GestorLoading() {
  return (
    <>
      <GestorNav active={null} />
      <ModuleSkeleton title="Carregando Painel de Gestão..." subtitle="Carregando métricas e dados estratégicos" />
    </>
  );
}
