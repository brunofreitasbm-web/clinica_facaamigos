import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TerapeutaBottomNav } from "@/components/terapeuta-bottom-nav";
import { TherapistKnowledgeBaseDrawer } from "@/components/therapist-knowledge-base-drawer";

/**
 * Layout do módulo Terapeuta — monta a nav (TerapeutaBottomNav) em toda tela
 * do portal, do mesmo jeito que app/recepcao/layout.tsx faz com a RecepcaoNav.
 */
async function TerapeutaNavByRole() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

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

