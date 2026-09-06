import Link from "next/link";
import { getTranscript } from "./simulador-actions";
import { SimulatorPanel } from "./simulator-panel";

export const dynamic = "force-dynamic";

export default async function WhatsappSimulatorPage() {
  const transcript = await getTranscript();

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#1c2530] p-8 space-y-6">
      <div className="flex items-center gap-2 text-xs text-[#57606b] mb-1">
        <Link href="/gestor" className="hover:underline text-[#0f5c7d]">
          Gestão
        </Link>
        <span>/</span>
        <Link href="/gestor/integracoes/whatsapp" className="hover:underline text-[#0f5c7d]">
          WhatsApp & Agente IA
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#1c2530]">Simulador</span>
      </div>
      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
        Simulador do chatbot
      </h1>
      <p className="text-sm text-[#57606b] max-w-2xl">
        Testa o fluxo inteiro do bot sem depender do Twilio — a conta ainda é trial, sem número aprovado pra
        WhatsApp. Escreva como se fosse o responsável; anexe um PDF quando o bot pedir laudo/guia.
      </p>
      <SimulatorPanel initialTranscript={transcript} />
    </div>
  );
}
