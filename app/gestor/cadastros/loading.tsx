import { ModuleSkeleton } from "@/components/module-skeleton";

export default function CadastrosLoading() {
  return <ModuleSkeleton fill={false} showCards={false} title="Cadastros" subtitle="Carregando lista de pacientes, equipe e convênios" />;
}
