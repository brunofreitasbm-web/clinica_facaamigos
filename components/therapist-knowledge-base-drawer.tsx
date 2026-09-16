"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle } from "lucide-react";

// O conteúdo real só é baixado quando o drawer é de fato aberto — antes ia
// inteiro no JS inicial de toda tela do portal do Terapeuta mesmo fechado.
const TherapistKnowledgeBasePanel = dynamic(
  () => import("./therapist-knowledge-base-panel").then((m) => m.TherapistKnowledgeBasePanel),
  { ssr: false },
);

interface TherapistKnowledgeBaseDrawerProps {
  initialOpen?: boolean;
}

export function TherapistKnowledgeBaseDrawer({ initialOpen = false }: TherapistKnowledgeBaseDrawerProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <>
      {/* Botão Flutuante de Ajuda na Tela do Terapeuta (Mobile & Desktop) */}
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 sm:bottom-6 sm:right-6">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:from-emerald-500 hover:to-teal-500 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-300 sm:px-4 sm:py-3"
          title="Abrir Base de Conhecimento do Terapeuta"
          id="btn-therapist-kb-floating"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
          </span>
          <HelpCircle className="h-5 w-5 text-white transition-transform group-hover:rotate-12" />
          <span className="font-semibold text-xs sm:text-sm tracking-wide">Manual do Terapeuta</span>
          <span className="hidden md:inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white uppercase">
            Clínico
          </span>
        </button>
      </div>

      {isOpen && <TherapistKnowledgeBasePanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
