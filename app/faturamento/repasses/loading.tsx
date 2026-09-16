import { ModuleSkeleton } from "@/components/module-skeleton";

export default function RepassesLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando repasses do faturamento" />;
}
