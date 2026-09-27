"use client";

import { usePathname } from "next/navigation";

/**
 * Remove os filhos da árvore (não só esconde via CSS) quando a rota atual
 * começa por um dos prefixos informados. Usado para tirar a barra global do
 * gestor da tela de atendimento (chat), que precisa da altura inteira.
 */
export function HideOnRoutes({
  prefixes,
  children,
}: {
  prefixes: readonly string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname && prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <>{children}</>;
}
