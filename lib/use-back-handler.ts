"use client";

import { useEffect, useRef } from "react";
import { createBackOwner } from "@/lib/back-handler";

/**
 * Botão/gesto "voltar" do celular fecha a subtela interna em vez de sair da página.
 *
 * `depth` = quantos passos internos existem agora (0 = nenhum); `onBack` desfaz
 * UM passo. Cada nível vira uma entrada de histórico (ver lib/back-handler.ts).
 * Chame antes de qualquer `return` condicional do componente.
 */
export function useBackHandler(depth: number, onBack: () => void) {
  const depthRef = useRef(0);
  const backRef = useRef(onBack);
  const handleRef = useRef<ReturnType<typeof createBackOwner> | null>(null);

  useEffect(() => {
    backRef.current = onBack;
  });

  useEffect(() => {
    depthRef.current = Math.max(0, depth | 0);
    handleRef.current?.sync();
  }, [depth]);

  useEffect(() => {
    const handle = createBackOwner({ getDepth: () => depthRef.current, onBack: () => backRef.current() });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, []);
}

/** Camadas da mais interna para a mais externa; o voltar desfaz a primeira ativa. */
export function useBackLayers(layers: { active: boolean; back: () => void }[]) {
  const active = layers.filter((layer) => layer.active);
  useBackHandler(active.length, () => active[0]?.back());
}
