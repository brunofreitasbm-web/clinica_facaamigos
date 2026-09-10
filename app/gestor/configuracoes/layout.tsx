import { ConfigSidebar } from "./config-sidebar";

/**
 * Layout da seção Configurações. A sidebar vive aqui (10/09/2026) em vez de
 * dentro de cada page.tsx/manager: assim ela persiste entre os cliques do
 * próprio menu, em vez de desmontar e remontar a cada navegação.
 * O cabeçalho do módulo é montado um nível acima, em app/gestor/layout.tsx.
 */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1">
      <ConfigSidebar />
      {children}
    </main>
  );
}
