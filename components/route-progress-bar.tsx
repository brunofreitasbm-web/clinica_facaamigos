"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CenterLoader } from "@/components/center-loader";

/** Primeiro segmento da rota ("/gestor/equipe" → "gestor") — a raiz de cada módulo/shell. */
function moduleRoot(pathname: string) {
  return pathname.split("/")[1] ?? "";
}

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  // Navegação pra dentro do MESMO módulo (mesmo cabeçalho, que agora vive no
  // layout e persiste) não é tratada como "saindo da tela": só a barra fina
  // do topo aparece, nunca o overlay central. Cruzar de módulo (Gestão →
  // Recepção, por ex.) é uma troca de shell de verdade — aí o overlay
  // continua honesto. Antes o overlay full-screen cobria as duas situações
  // por igual e apagava o efeito de ter um cabeçalho persistente por baixo.
  const [crossModule, setCrossModule] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // When path or query params change, hide progress bar
    queueMicrotask(() => setLoading(false));
    setShowOverlay(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!loading || !crossModule) return;
    // Só exibe o overlay central se a navegação demorar — evita "flash" em trocas instantâneas.
    const timer = setTimeout(() => setShowOverlay(true), 220);
    return () => clearTimeout(timer);
  }, [loading, crossModule]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a") as HTMLAnchorElement | null;
      if (!target || !target.href) return;

      // Skip external links, target="_blank", or download links
      if (target.target === "_blank" || target.hasAttribute("download")) return;

      try {
        const targetUrl = new URL(target.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.origin === currentUrl.origin &&
          (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search)
        ) {
          setCrossModule(moduleRoot(targetUrl.pathname) !== moduleRoot(currentUrl.pathname));
          setLoading(true);
        }
      } catch {
        // Ignore invalid URL parse errors
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, []);

  if (!loading) return null;

  return (
    <>
      <div className="route-progress-bar" aria-hidden="true" />
      {showOverlay && <CenterLoader overlay label="Carregando página..." />}
    </>
  );
}
