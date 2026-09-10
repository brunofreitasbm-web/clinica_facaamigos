import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TerapeutaBottomNav } from "@/components/terapeuta-bottom-nav";

/**
 * Layout do módulo Terapeuta — monta a nav (TerapeutaBottomNav) em toda tela
 * do portal, do mesmo jeito que app/recepcao/layout.tsx faz com a RecepcaoNav.
 * Antes cada page.tsx renderizava a própria cópia da nav: ela remontava a
 * cada navegação e faltava por completo em /terapeuta/metricas e
 * /terapeuta/repasse, que viravam becos sem saída.
 *
 * O layout é SÍNCRONO de propósito. `loading.tsx` não cobre o layout: um
 * `await` aqui bloquearia a entrada no módulo inteiro antes de qualquer
 * pixel (ver next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * loading.md). O papel só é necessário pra esconder a nav na tela de
 * evolução, então ele entra por um <Suspense> próprio, com a nav de
 * terapeuta como fallback — o caso comum aparece na hora e só o raro
 * (gestor/supervisor assinando por um colega) se ajusta depois.
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
    </>
  );
}
