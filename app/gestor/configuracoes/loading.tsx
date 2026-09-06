import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function ConfiguracoesLoading() {
  return (
    <>
      <GestorNav active="configuracoes" />
      <ModuleSkeleton title="Configurações do Sistema" subtitle="Carregando opções gerais e parâmetros" />
    </>
  );
}
