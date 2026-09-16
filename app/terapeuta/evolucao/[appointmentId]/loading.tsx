import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Formulário de evolução (evolution-form.tsx, 1106 linhas, o maior "use
 * client" do módulo Terapeuta) — sem loading.tsx próprio, abrir uma sessão
 * pra evoluir travava a tela até os dados da sessão/protocolo carregarem.
 */
export default function EvolucaoLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando dados da sessão" />;
}
