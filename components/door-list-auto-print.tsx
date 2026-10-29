"use client";

import { useEffect, useRef, useState } from "react";
import { todayInTimeZone } from "@/lib/timezone";
import { CLINIC_TIMEZONE } from "@/lib/constants";

const STORAGE_KEY = "facaamigos:door-list-printed";

/**
 * Imprime sozinha a lista do dia da 1ª avaliação (acrílico da porta) na
 * primeira vez que a recepção abre o sistema no dia, neste navegador.
 *
 * O navegador não enxerga se a impressora está ligada: a impressão vai para a
 * fila do Windows, que despacha quando ela liga. Sem diálogo apenas se o
 * Chrome abrir com --kiosk-printing; sem a flag, aparece o diálogo normal.
 * Sem avaliações no dia, não imprime. Só marca o dia como impresso depois de
 * chamar print() ou de confirmar que não há nada a imprimir.
 */
export function DoorListAutoPrint() {
  const [pending, setPending] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const today = todayInTimeZone(CLINIC_TIMEZONE);
    try {
      if (localStorage.getItem(STORAGE_KEY) === today) return;
    } catch {
      // localStorage indisponível: sem trava diária, imprime a cada abertura.
    }
    setPending(true);

    function onMessage(e: MessageEvent) {
      if (e.origin !== location.origin || e.data?.type !== "door-list") return;
      if (e.data.state === "ready") frame.current?.contentWindow?.print();
      try {
        localStorage.setItem(STORAGE_KEY, today);
      } catch {
        // idem acima
      }
      setPending(false);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!pending) return null;
  return (
    <iframe
      ref={frame}
      src="/recepcao/lista-porta?auto=1"
      title="Lista da porta da sala de avaliação"
      aria-hidden
      tabIndex={-1}
      style={{ position: "fixed", left: "-10000px", top: 0, width: "794px", height: "1123px", border: 0 }}
    />
  );
}
