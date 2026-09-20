"use client";

import { useEffect } from "react";

type KeyHandler = (e: KeyboardEvent) => void;

interface HotkeyConfig {
  key: string; // e.g. "a", "c", "ArrowUp", "ArrowDown"
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  handler: KeyHandler;
}

export function useHotkeys(hotkeys: HotkeyConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora atalhos de navegação genéricos se a tecla for pressionada em um input que processa digitação comum,
      // a menos que o atalho inclua Alt/Ctrl/Meta.
      for (const hotkey of hotkeys) {
        const matchesKey = e.key.toLowerCase() === hotkey.key.toLowerCase();
        const matchesAlt = Boolean(hotkey.altKey) === e.altKey;
        const matchesCtrl = Boolean(hotkey.ctrlKey) === e.ctrlKey;
        const matchesMeta = Boolean(hotkey.metaKey) === e.metaKey;
        const matchesShift = Boolean(hotkey.shiftKey) === e.shiftKey;

        if (matchesKey && matchesAlt && matchesCtrl && matchesMeta && matchesShift) {
          e.preventDefault();
          hotkey.handler(e);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hotkeys, enabled]);
}
