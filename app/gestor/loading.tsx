import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Fallback de TODAS as telas de /gestor (é o boundary mais próximo pra
 * navegação entre irmãos). Por isso o texto é neutro: antes dizia
 * "Carregando Painel de Gestão...", que aparecia mesmo indo pra Financeiro
 * ou Configurações e reforçava a sensação de ter voltado pro começo.
 */
export default function GestorLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando dados atualizados da clínica" />;
}
