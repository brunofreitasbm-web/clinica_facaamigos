import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function BonificacaoLoading() {
  return (
    <>
      <GestorNav active="bonificacao" />
      <ModuleSkeleton title="PLR & Faixas de Premiação" subtitle="Carregando regras e cálculos de bonificação" />
    </>
  );
}
