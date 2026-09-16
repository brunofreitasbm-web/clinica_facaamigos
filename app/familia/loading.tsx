import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Fallback de /familia — o módulo não tem layout.tsx (nenhum cabeçalho
 * persistente pra herdar), então `fill` fica no default (`true`, tela
 * cheia). Sem isso, o portal da família (a tela mais pesada do app, 1074
 * linhas) ficava travado em branco até a query da página resolver.
 */
export default function FamiliaLoading() {
  return <ModuleSkeleton title="Carregando..." subtitle="Buscando as informações da sua família" />;
}
