"use client";

import React, { useState, useCallback } from "react";
import { useHotkeys } from "@/src/hooks/useHotkeys";
import { InteressadoRapidoDialog } from "@/app/recepcao/interessado-rapido-dialog";
import type { ConversationRow } from "@/app/recepcao/atendimento/atendimento-shell";

interface ChatLayoutProps {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onAssignActiveConversation?: () => void;
  children: React.ReactNode;
}

export function ChatLayout({
  conversations,
  selectedId,
  onSelectConversation,
  onAssignActiveConversation,
  children,
}: ChatLayoutProps) {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Atalho Alt + Up / Alt + Down para navegar entre conversas da fila
  const handleNavigateQueue = useCallback(
    (direction: "up" | "down") => {
      if (conversations.length === 0) return;
      const currentIndex = conversations.findIndex((c) => c.id === selectedId);

      if (currentIndex === -1) {
        onSelectConversation(conversations[0].id);
        return;
      }

      if (direction === "up" && currentIndex > 0) {
        onSelectConversation(conversations[currentIndex - 1].id);
      } else if (direction === "down" && currentIndex < conversations.length - 1) {
        onSelectConversation(conversations[currentIndex + 1].id);
      }
    },
    [conversations, selectedId, onSelectConversation],
  );

  // Mapeamento dos atalhos globais de teclado
  useHotkeys([
    {
      key: "a",
      altKey: true,
      handler: () => {
        onAssignActiveConversation?.();
      },
    },
    {
      key: "c",
      altKey: true,
      handler: () => {
        setIsRegisterModalOpen(true);
      },
    },
    {
      key: "ArrowUp",
      altKey: true,
      handler: () => {
        handleNavigateQueue("up");
      },
    },
    {
      key: "ArrowDown",
      altKey: true,
      handler: () => {
        handleNavigateQueue("down");
      },
    },
  ]);

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 relative">
      {children}

      {/* Modal controlado de Cadastro de Interessado acionado por Alt+C ou botão */}
      <InteressadoRapidoDialog
        isOpen={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        hideTriggerButton
        conversationId={selectedId}
      />
    </div>
  );
}
