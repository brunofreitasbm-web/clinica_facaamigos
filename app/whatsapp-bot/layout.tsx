import { ReactNode } from "react";
import { WhatsappBotNav } from "@/components/whatsapp-bot-nav";

export const metadata = {
  title: "Validação de Documentos de Anamnese (WhatsApp Bot) | Faça Amigos",
  description: "Módulo exclusivo para validação de documentos, automação de agendamentos e gestão de disparos via WhatsApp Bot.",
};

export default function WhatsappBotLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      <WhatsappBotNav />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
