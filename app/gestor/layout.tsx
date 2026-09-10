import { Suspense } from "react";
import { GestorNav } from "@/components/gestor-nav";
import { NpsAlertsBadge } from "@/components/nps-alerts-badge";

/**
 * Layout do módulo Gestão — monta o cabeçalho (GestorNav) uma vez só pra
 * todas as telas de /gestor, como app/recepcao/layout.tsx faz com a
 * RecepcaoNav. Cada page.tsx entrega só o conteúdo.
 *
 * SÍNCRONO de propósito: `loading.tsx` não cobre o layout, então qualquer
 * `await` aqui bloquearia a entrada em /gestor antes de qualquer pixel (ver
 * next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md).
 * A contagem de alertas de NPS entra por um <Suspense> próprio: a barra
 * aparece na hora e o badge preenche depois.
 */
export default function GestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GestorNav
        npsBadge={
          <Suspense fallback={null}>
            <NpsAlertsBadge />
          </Suspense>
        }
      />
      {children}
    </div>
  );
}
