"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { NAV_DEPTH_KEY } from "@/components/nav-history-tracker";

/**
 * "Voltar" genérico pra qualquer tela do app, independente do módulo.
 * Antes, cada tela linkava pra um destino fixo (ex.: sempre
 * "/recepcao/pacientes"), o que quebrava quando a entrada vinha de outro
 * módulo (ex.: supervisão abrindo a ficha do paciente pelo painel de
 * Fluxos) — "Voltar" não devolvia pra onde o usuário estava.
 *
 * Aqui, sempre que existe navegação anterior nesta aba (ver
 * NavHistoryTracker), usamos router.back() — que leva de volta pra tela
 * real de origem, seja qual for o módulo, sem precisar decidir permissão
 * aqui: o middleware (lib/supabase/middleware.ts) já validou o acesso do
 * usuário quando aquela tela foi carregada da primeira vez. `fallbackHref`
 * só é usado quando não há histórico dentro do app (link direto, aba nova,
 * recarregar) — mesmo destino fixo que cada tela já usava antes.
 */
export function BackButton({
  fallbackHref,
  children,
  className,
  style,
}: {
  fallbackHref: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();

  function handleClick() {
    let depth = 0;
    try {
      depth = Number(sessionStorage.getItem(NAV_DEPTH_KEY) ?? "0");
    } catch {
      // sessionStorage indisponível — trata como sem histórico.
    }
    if (depth > 0) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", ...style }}
    >
      {children}
    </button>
  );
}
