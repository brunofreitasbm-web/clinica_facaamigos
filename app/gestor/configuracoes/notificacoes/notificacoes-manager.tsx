"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

interface TemplateMessage {
  id: string;
  name: string;
  channel: "WhatsApp" | "E-mail" | "SMS";
  triggerEvent: string;
  body: string;
  active: boolean;
}

const INITIAL_TEMPLATES: TemplateMessage[] = [
  {
    id: "n-1",
    name: "Confirmação de Sessão D-1 (Família)",
    channel: "WhatsApp",
    triggerEvent: "24h antes do horário da sessão",
    body: "Olá, {responsavel}! Confirmamos a sessão de {paciente} com {terapeuta} amanhã às {hora}? Responda 1 para CONFIRMAR ou 2 para REMARCAR.",
    active: true,
  },
  {
    id: "n-2",
    name: "Cobrança de Evolução Pendente > 24h (Terapeuta)",
    channel: "WhatsApp",
    triggerEvent: "Job diário às 20h para evoluções não assinadas",
    body: "Atenção, {terapeuta}! Você possui {quantidade} evolução(ões) pendente(s) de preenchimento registradas há mais de 24h.",
    active: true,
  },
  {
    id: "n-3",
    name: "Alerta de Guia Vencendo em 15 Dias (Recepção)",
    channel: "WhatsApp",
    triggerEvent: "15 dias antes da validade da autorização",
    body: "Aviso de Guia: A autorização do paciente {paciente} no convênio {convenio} vence em {data_validade}. Solicitar novo pedido médico.",
    active: true,
  },
];

export function NotificacoesManager() {
  const [templates, setTemplates] = useState<TemplateMessage[]>(INITIAL_TEMPLATES);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("20:00");

  const toggleTemplate = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    );
  };

  return (
    <>
      <ConfigSidebar active="notificacoes" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Notificações & WhatsApp"
          description="Templates de mensagens automáticas de confirmação D-1, cobrança de evolução e alertas de autorização."
        />

        <div className="flex flex-col gap-8 p-6 sm:p-10 max-w-4xl">
          {/* Janela de Envio */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Janela de Envio Automático</h3>
            <p className="text-xs text-ink-faint">Período permitido para disparos automáticos de WhatsApp/SMS sem incomodar o paciente.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 max-w-md">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Horário Inicial</label>
                <input
                  type="time"
                  className="input"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Horário Limite</label>
                <input
                  type="time"
                  className="input"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Templates de Notificação */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-ink-strong">Templates de Mensagens</h3>
                <p className="text-xs text-ink-faint">Modelos com variáveis dinâmicas enviadas pelo gateway WhatsApp (PRD §116).</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-paper-line p-4 bg-paper/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-ink-strong">{t.name}</span>
                      <span className="tag tag-outline text-[10px]">{t.channel}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-paper-line text-accent"
                        checked={t.active}
                        onChange={() => toggleTemplate(t.id)}
                      />
                      <span className="text-xs font-medium text-ink-faint">
                        {t.active ? "Ativo" : "Inativo"}
                      </span>
                    </label>
                  </div>

                  <p className="text-xs text-ink-faint">Gatilho: <span className="font-medium">{t.triggerEvent}</span></p>

                  <div className="rounded border border-paper-line bg-paper p-3 text-xs font-mono text-ink-strong">
                    {t.body}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-paper-line flex justify-end">
              <button onClick={() => alert("Configuração de notificações salva com sucesso!")} className="button button-primary">
                Salvar Templates de Notificação
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
