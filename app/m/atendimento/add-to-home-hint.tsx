"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "m_atendimento_add_to_home_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari expõe isso fora do padrão.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS não oferece prompt automático de instalação (beforeinstallprompt só
 * existe no Chrome/Android) — este banner ensina manualmente
 * "Compartilhar → Adicionar à Tela de Início". Aparece uma vez por
 * navegador (localStorage), some se o app já estiver instalado.
 */
export function AddToHomeHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (isStandalone()) return;
      if (localStorage.getItem(DISMISS_KEY)) return;
      setVisible(true);
    } catch {
      // localStorage indisponível (modo privado) — não mostra o banner.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem persistência — o banner pode voltar na próxima visita, sem problema.
    }
  };

  return (
    <div
      className="fixed inset-x-3 z-40 flex items-center gap-2 rounded-[14px] px-3 py-2.5 text-[13px] font-semibold text-white"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        background: "var(--color-accent-700)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <span className="flex-1">
        Adicione à tela inicial: toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
      </span>
      <button type="button" aria-label="Dispensar" onClick={dismiss} className="flex h-8 w-8 shrink-0 items-center justify-center">
        <X size={16} />
      </button>
    </div>
  );
}
