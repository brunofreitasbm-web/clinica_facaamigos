"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle } from "lucide-react";

// O conteúdo real (formulário de busca, ~30 artigos, board didático) só é
// baixado quando o drawer é de fato aberto — antes ia inteiro no JS inicial
// de toda tela de /recepcao mesmo fechado. ssr:false porque o conteúdo só
// existe depois de um clique do usuário, nunca no primeiro paint.
const KnowledgeBasePanel = dynamic(
  () => import("./knowledge-base-panel").then((m) => m.KnowledgeBasePanel),
  { ssr: false },
);

interface KnowledgeBaseDrawerProps {
  initialOpen?: boolean;
}

export function KnowledgeBaseDrawer({ initialOpen = false }: KnowledgeBaseDrawerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <>
      {/* Botão Flutuante de Ajuda / Base de Conhecimento na Tela */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:scale-105 hover:from-rose-500 hover:to-pink-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-rose-300"
          title="Abrir Base de Conhecimento da Recepção"
          id="btn-reception-kb-floating"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
          </span>
          <HelpCircle className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-sm tracking-wide">Manual de Recepção</span>
          <span className="hidden sm:inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white uppercase">
            Recepção
          </span>
        </button>
      </div>

      {isOpen && <KnowledgeBasePanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
