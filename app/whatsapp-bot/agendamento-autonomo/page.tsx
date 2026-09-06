import { TwilioChatbotTestPanel } from "@/components/twilio-chatbot-test-panel";
import { Bot, Sparkles, CheckCircle, MessageSquare } from "lucide-react";

export default function AgendamentoAutonomoPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-950 border border-teal-500/30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Automação & Chatbot de Agendamento (WhatsApp)
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                IA Operacional
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule a máquina de estados do Bot do WhatsApp, qualificações de laudo e oferta autônoma de vagas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TwilioChatbotTestPanel />
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Etapas do Bot de Agendamento
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>1. Triagem Inicial:</strong> Coleta do nome da criança, responsável e CPF.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>2. Envio de Documentos:</strong> Solicitação do PDF do Laudo Médico e Guia.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>3. Validação Supervisionada:</strong> Envio para a fila de validação de Anamnese.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>4. Oferta de Agendamento:</strong> Seleção interativa de horários disponíveis.</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
              Gatilhos Automáticos
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              O bot responde instantaneamente às mensagens recebidas na linha oficial do WhatsApp Twilio, mantendo o histórico unificado por paciente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
