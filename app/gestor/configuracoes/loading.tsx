import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Fallback das telas de Configurações. Entra ao lado da ConfigSidebar (que
 * agora vive no layout da seção), não no lugar dela — antes este arquivo
 * renderizava um segundo GestorNav, empilhando dois cabeçalhos navy, e a
 * sidebar sumia durante a troca de item.
 */
export default function ConfiguracoesLoading() {
  return <ModuleSkeleton fill={false} showCards={false} title="Configurações do Sistema" subtitle="Carregando opções gerais e parâmetros" />;
}
