"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle } from "lucide-react";

// O conteúdo real só é baixado quando o drawer é de fato aberto — antes ia
// inteiro no JS inicial de toda tela de /supervisao mesmo fechado.
const SupervisaoKnowledgeBasePanel = dynamic(
  () => import("./supervisao-knowledge-base-panel").then((m) => m.SupervisaoKnowledgeBasePanel),
  { ssr: false },
);

interface SupervisaoKnowledgeBaseDrawerProps {
  initialOpen?: boolean;
}

export function SupervisaoKnowledgeBaseDrawer({ initialOpen = false }: SupervisaoKnowledgeBaseDrawerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <>
      {/* Botão Flutuante de Ajuda na Tela de Supervisão */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-105 hover:from-indigo-500 hover:to-violet-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300"
          title="Abrir Base de Conhecimento da Supervisão"
          id="btn-supervision-kb-floating"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
          </span>
          <HelpCircle className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-sm tracking-wide">Manual de Supervisão</span>
          <span className="hidden sm:inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white uppercase">
            Coordenação
          </span>
        </button>
      </div>

      {isOpen && <SupervisaoKnowledgeBasePanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
