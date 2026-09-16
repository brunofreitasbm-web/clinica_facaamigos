import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Ficha do paciente vista pelo terapeuta (353 linhas) — sem loading.tsx
 * próprio, navegar até aqui de dentro do portal do terapeuta travava a
 * tela até a query resolver.
 */
export default function TerapeutaPacienteLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando dados do paciente" />;
}
