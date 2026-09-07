import { PageHeader } from "@/components/page-header";
import { TwilioChatbotTestPanel } from "@/components/twilio-chatbot-test-panel";
import { ConfigSidebar } from "../config-sidebar";

// O "gerenciador de modelos de notificação" que existia aqui era só um
// formulário local (useState) com "salvar" simulado — nenhuma tabela do
// schema sustenta modelos de notificação por template/janela de envio. Só o
// testador do chatbot Twilio (abaixo) é funcional de verdade: chama a
// mesma lógica de resposta usada no webhook real (lib/twilio.ts).
export const dynamic = "force-dynamic";

export default function NotificacoesPage() {
  return (
    <>
      <ConfigSidebar active="notificacoes" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="WhatsApp Bot"
          description="Teste o mesmo bot que responde no WhatsApp real da clínica, sem enviar nenhuma mensagem de verdade."
        />
        <div className="max-w-2xl p-6 sm:p-10">
          <TwilioChatbotTestPanel />
        </div>
      </div>
    </>
  );
}
