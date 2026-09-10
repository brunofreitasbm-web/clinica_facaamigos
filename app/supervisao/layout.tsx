import { SupervisaoTabProvider } from "./supervisao-tab-context";
import { SupervisaoHeader } from "@/components/supervisao-header";
import { SupervisaoKnowledgeBaseDrawer } from "@/components/supervisao-knowledge-base-drawer";

/**
 * Layout do módulo Coordenação — monta o cabeçalho (SupervisaoHeader) em
 * toda tela do módulo.
 */
export default function SupervisaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupervisaoTabProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <SupervisaoHeader />
        {children}
        <SupervisaoKnowledgeBaseDrawer />
      </div>
    </SupervisaoTabProvider>
  );
}

