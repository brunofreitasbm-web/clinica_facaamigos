import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function FinanceiroLoading() {
  return (
    <>
      <GestorNav active="financeiro" />
      <ModuleSkeleton title="Módulo Financeiro" subtitle="Carregando repasses, faturamento e contas da clínica" />
    </>
  );
}
