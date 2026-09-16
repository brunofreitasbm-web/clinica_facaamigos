import { Suspense } from "react";
import { getViewerProfile } from "@/lib/auth/viewer";
import { TerapeutaBottomNav } from "@/components/terapeuta-bottom-nav";
import { TherapistKnowledgeBaseDrawer } from "@/components/therapist-knowledge-base-drawer";

/**
 * Layout do módulo Terapeuta — monta a nav (TerapeutaBottomNav) em toda tela
 * do portal, do mesmo jeito que app/recepcao/layout.tsx faz com a RecepcaoNav.
 *
 * getViewerProfile() (cache() por request) — app/terapeuta/page.tsx faz a
 * mesma checagem de papel no mesmo render; antes duplicava getUser()+profiles.
 */
async function TerapeutaNavByRole() {
  const profile = await getViewerProfile();
  return <TerapeutaBottomNav role={profile?.role ?? null} />;
}

export default function TerapeutaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<TerapeutaBottomNav role="terapeuta" />}>
        <TerapeutaNavByRole />
      </Suspense>
      {children}
      <TherapistKnowledgeBaseDrawer />
    </>
  );
}

