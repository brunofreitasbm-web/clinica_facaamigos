import { PageHeader } from "@/components/page-header";
import { TwilioChatbotTestPanel } from "@/components/twilio-chatbot-test-panel";
import { ConfigSidebar } from "../config-sidebar";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { TemplatesManager, type TemplateRow } from "./templates-manager";

// O "gerenciador de modelos de notificação" que existia aqui era só um
// formulário local (useState) com "salvar" simulado — nenhuma tabela do
// schema sustentava modelos de notificação. Agora `message_templates`
// existe de verdade (Onda 3 do roadmap de módulos) e este painel também
// mostra o histórico real de entrega vindo de `messages`, já alimentado
// pelos fluxos de WhatsApp/SMS existentes.
export const dynamic = "force-dynamic";

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  undelivered: "Não entregue",
};

export default async function NotificacoesPage() {
  const supabase = await createClient();

  const { data: templateRows } = await supabase
    .from("message_templates")
    .select("id, category, name, channel, body, meta_approved, active")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("created_at", { ascending: false });

  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, body, channel, direction, delivery_status, sent_at, patients!inner(full_name, clinic_id)")
    .eq("patients.clinic_id", DEV_CLINIC_ID)
    .eq("direction", "outbound")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(30);

  const templates: TemplateRow[] = templateRows ?? [];

  return (
    <>
      <ConfigSidebar active="notificacoes" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Comunicação & WhatsApp"
          description="Modelos de mensagem, histórico de entrega e o testador do bot de WhatsApp."
        />
        <div className="flex flex-col gap-10 max-w-4xl p-6 sm:p-10">
          <section>
            <h3 className="mb-4">Modelos de Mensagem</h3>
            <p className="text-xs text-ink-faint mb-4">
              Catálogo interno de textos por categoria. A aprovação da Meta é marcada manualmente aqui — não há integração
              automática com a API de aprovação de templates do WhatsApp Business. Os disparos automáticos (D-1, faltas, NPS)
              continuam usando o texto fixo já implementado em cada rotina — este catálogo ainda não está religado a eles.
            </p>
            <TemplatesManager templates={templates} />
          </section>

          <section>
            <h3 className="mb-4">Histórico de Entrega (últimas 30 mensagens enviadas)</h3>
            {(messageRows ?? []).length === 0 ? (
              <p className="text-sm text-ink-faint">Nenhuma mensagem enviada registrada ainda.</p>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Canal</th>
                    <th>Mensagem</th>
                    <th>Status</th>
                    <th>Enviada em</th>
                  </tr>
                </thead>
                <tbody>
                  {(messageRows ?? []).map((m: any) => (
                    <tr key={m.id}>
                      <td className="text-xs font-semibold">{m.patients?.full_name ?? "—"}</td>
                      <td className="text-xs uppercase">{m.channel}</td>
                      <td className="max-w-xs truncate text-xs text-ink-soft" title={m.body ?? ""}>
                        {m.body ?? "—"}
                      </td>
                      <td>
                        <span className={`tag-status ${m.delivery_status === "failed" || m.delivery_status === "undelivered" ? "st-falta" : "st-realizada"}`}>
                          {DELIVERY_STATUS_LABEL[m.delivery_status ?? ""] ?? m.delivery_status ?? "—"}
                        </span>
                      </td>
                      <td className="tabular-figure text-xs text-ink-faint">
                        {m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3 className="mb-4">Testador do Bot</h3>
            <TwilioChatbotTestPanel />
          </section>
        </div>
      </div>
    </>
  );
}
