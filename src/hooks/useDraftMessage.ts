"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export function useDraftMessage(chatId: string | null | undefined, type: "chat" | "internal_note" = "chat") {
  const key = chatId ? `draft_msg_${type}_${chatId}` : null;
  const [draft, setDraftState] = useState<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carrega do sessionStorage ao mudar de conversa ou tipo
  useEffect(() => {
    if (!key || typeof window === "undefined") {
      setDraftState("");
      return;
    }
    try {
      const saved = sessionStorage.getItem(key);
      setDraftState(saved ?? "");
    } catch {
      setDraftState("");
    }
  }, [key]);

  // Atualiza estado local e agenda salvamento no sessionStorage com debounce de 300ms
  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      if (!key || typeof window === "undefined") return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        try {
          if (value.trim()) {
            sessionStorage.setItem(key, value);
          } else {
            sessionStorage.removeItem(key);
          }
        } catch {
          // Ignora falhas de escrita (ex: quota excedida)
        }
      }, 300);
    },
    [key],
  );

  // Limpa o rascunho (após envio com sucesso)
  const clearDraft = useCallback(() => {
    setDraftState("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (key && typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Ignora erro
      }
    }
  }, [key]);

  return { draft, setDraft, clearDraft };
}
