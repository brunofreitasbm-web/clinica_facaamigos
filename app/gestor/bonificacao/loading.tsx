import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function BonificacaoLoading() {
  return (
    <>
      <GestorNav active="equipe" />
      <ModuleSkeleton title="PLR & Faixas de Premiação" subtitle="Carregando regras e cálculos de bonificação" />
    </>
  );
}
