import { Suspense } from "react";
import { RecepcaoNav } from "@/components/recepcao-nav";
import { RecepcaoNavBadges } from "./nav-badges";
import { KnowledgeBaseDrawer } from "@/components/knowledge-base-drawer";
import { BonusFloatingWidget } from "@/components/bonus-floating-widget-lazy";

export const dynamic = "force-dynamic";

/**
 * Layout do módulo Recepção — monta o cabeçalho (RecepcaoNav) em toda tela
 * do módulo. Cada página sob app/recepcao só entrega o conteúdo daquela tela.
 *
 * SÍNCRONO de propósito, igual a app/gestor/layout.tsx e
 * app/terapeuta/layout.tsx: qualquer `await` aqui bloquearia a entrada em
 * qualquer tela de /recepcao antes de qualquer pixel, porque `loading.tsx`
 * do segmento filho NÃO cobre o await de um layout ancestral. Os badges (fila
 * de pendências, chegadas) que antes eram buscados aqui agora vivem em
 * RecepcaoNavBadges, um Server Component async isolado sob <Suspense> — o nav
 * pinta na hora com os badges "vazios" e eles aparecem assim que a query
 * resolve, sem travar a navegação.
 */
export default function RecepcaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<RecepcaoNav pendingCount={null} chegadasCount={null} />}>
        <RecepcaoNavBadges />
      </Suspense>
      {children}
      <KnowledgeBaseDrawer />
      <BonusFloatingWidget />
    </div>
  );
}
