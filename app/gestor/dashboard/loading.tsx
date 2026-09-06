import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function DashboardLoading() {
  return (
    <>
      <GestorNav active="painel" />
      <ModuleSkeleton title="Painel Geral" subtitle="Carregando resumos executivos e operacionais" />
    </>
  );
}
