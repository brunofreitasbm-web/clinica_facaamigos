import { ModuleSkeleton } from "@/components/module-skeleton";

export default function PendenciasLoading() {
  return (
    <ModuleSkeleton
      title="Fila de pendências"
      subtitle="Carregando contatos, documentos e prazos..."
      fill={false}
    />
  );
}
