"use client";

import { useState } from "react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { TwilioChatbotTestPanel } from "@/components/twilio-chatbot-test-panel";
import { DashboardPanel, type ChatbotDashboardStats } from "./dashboard-panel";
import { FaqManager, type FaqRow } from "./faq-manager";
import { QuickResponsesManager, type QuickResponseRow } from "./quick-responses-manager";
import { TemplatesManager, type TemplateRow } from "./templates-manager";
import { SettingsPanel, type ChatbotSettingsRow } from "./settings-panel";

export type DeliveryHistoryRow = {
  id: string;
  patientName: string | null;
  channel: string;
  body: string | null;
  deliveryStatus: string | null;
  sentAt: string | null;
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  undelivered: "Não entregue",
  simulated_dev: "Simulada (dev)",
};

const SECTIONS = [
  { key: "painel", label: "Painel" },
  { key: "faq", label: "FAQ" },
  { key: "respostas-rapidas", label: "Respostas Rápidas" },
  { key: "modelos", label: "Modelos" },
  { key: "testador", label: "Testador" },
  { key: "configuracoes", label: "Configurações" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function ChatbotPanel({
  clinicId,
  stats,
  faqs,
  quickResponses,
  templates,
  deliveryHistory,
  settings,
}: {
  clinicId: string;
  stats: ChatbotDashboardStats;
  faqs: FaqRow[];
  quickResponses: QuickResponseRow[];
  templates: TemplateRow[];
  deliveryHistory: DeliveryHistoryRow[];
  settings: ChatbotSettingsRow;
}) {
  const [section, setSection] = useState<SectionKey>("painel");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex gap-1 overflow-x-auto border-b border-paper-line-strong bg-paper px-4 pt-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              section === s.key
                ? "border-b-2 border-accent text-ink"
                : "text-ink-faint hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        {section === "painel" && <DashboardPanel stats={stats} />}

        {section === "faq" && <FaqManager faqs={faqs} />}

        {section === "respostas-rapidas" && <QuickResponsesManager clinicId={clinicId} responses={quickResponses} />}

        {section === "modelos" && (
          <div className="flex flex-col gap-10">
            <section>
              <h3 className="mb-1">Modelos de Mensagem</h3>
              <p className="text-xs text-ink-faint mb-4">
                Catálogo interno de textos por categoria. A aprovação da Meta é marcada manualmente aqui — não há
                integração automática com a API de aprovação de templates do WhatsApp Business. Os disparos
                automáticos (D-1, faltas, NPS) continuam usando o texto fixo já implementado em cada rotina — este
                catálogo ainda não está religado a eles.
              </p>
              <TemplatesManager templates={templates} />
            </section>

            <section>
              <h3 className="mb-4">Histórico de Entrega (últimas 30 mensagens enviadas)</h3>
              {deliveryHistory.length === 0 ? (
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
                    {deliveryHistory.map((m) => (
                      <tr key={m.id}>
                        <td className="text-xs font-semibold">{m.patientName ?? "—"}</td>
                        <td className="text-xs uppercase">{m.channel}</td>
                        <td className="max-w-xs truncate text-xs text-ink-soft" title={m.body ?? ""}>
                          {m.body ?? "—"}
                        </td>
                        <td>
                          <span
                            className={`tag-status ${
                              m.deliveryStatus === "failed" || m.deliveryStatus === "undelivered"
                                ? "st-falta"
                                : "st-realizada"
                            }`}
                          >
                            {DELIVERY_STATUS_LABEL[m.deliveryStatus ?? ""] ?? m.deliveryStatus ?? "—"}
                          </span>
                        </td>
                        <td className="tabular-figure text-xs text-ink-faint">
                          {m.sentAt ? new Date(m.sentAt).toLocaleString("pt-BR", { timeZone: CLINIC_TIMEZONE }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {section === "testador" && (
          <div>
            <h3 className="mb-4">Testador do Bot</h3>
            <TwilioChatbotTestPanel />
          </div>
        )}

        {section === "configuracoes" && <SettingsPanel settings={settings} />}
      </div>
    </div>
  );
}
