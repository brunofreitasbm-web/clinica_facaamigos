import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function CadastrosLoading() {
  return (
    <>
      <GestorNav active="cadastros" />
      <ModuleSkeleton title="Cadastros Gerais" subtitle="Carregando lista de pacientes, equipe e convênios" />
    </>
  );
}
