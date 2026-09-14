"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const NAV_DEPTH_KEY = "__nav_depth";

/**
 * Conta quantas navegações client-side aconteceram nesta aba. O
 * BackButton (components/back-button.tsx) usa essa contagem pra saber se
 * router.back() tem pra onde voltar dentro do app — sem isso, um "Voltar"
 * clicado numa página aberta direto (link externo, recarregar, aba nova)
 * levaria o usuário pra fora do app em vez de ficar sem efeito.
 *
 * Montado uma única vez em app/layout.tsx, então cobre qualquer módulo
 * (recepção, terapeuta, supervisão, etc.) — inclusive troca de módulo, que
 * no App Router é só mais uma navegação client-side.
 */
export function NavHistoryTracker() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    try {
      if (!mounted.current) {
        mounted.current = true;
        if (sessionStorage.getItem(NAV_DEPTH_KEY) === null) {
          sessionStorage.setItem(NAV_DEPTH_KEY, "0");
        }
        return;
      }
      const depth = Number(sessionStorage.getItem(NAV_DEPTH_KEY) ?? "0");
      sessionStorage.setItem(NAV_DEPTH_KEY, String(depth + 1));
    } catch {
      // sessionStorage indisponível (ex.: modo privado) — BackButton cai
      // sempre no fallbackHref, sem quebrar a navegação.
    }
  }, [pathname]);

  return null;
}
