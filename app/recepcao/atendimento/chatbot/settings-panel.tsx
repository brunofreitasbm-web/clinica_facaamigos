"use client";

import { useState, useTransition } from "react";
import { updateChatbotSettings } from "./settings-actions";

export type ChatbotSettingsRow = {
  botEnabled: boolean;
  dailyReplyLimit: number;
  greetingFallback: string | null;
};

export function SettingsPanel({ settings }: { settings: ChatbotSettingsRow }) {
  const [botEnabled, setBotEnabled] = useState(settings.botEnabled);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <h3 className="mb-1">Configurações do Chatbot</h3>
      <p className="mb-6 text-sm text-ink-soft">
        Parâmetros gerais do assistente virtual de WhatsApp. O controle de bot ativo/humano por conversa individual
        continua no cabeçalho de cada chat, na aba Conversas — o interruptor abaixo é a chave-geral, para os casos
        raros em que é preciso pausar todos os atendimentos automáticos de uma vez (ex.: um incidente ou uma decisão
        de suspender o bot temporariamente).
      </p>

      <form
        className="flex max-w-xl flex-col gap-5 rounded-md border border-paper-line-strong bg-paper/60 p-5"
        action={(formData) => {
          setError(null);
          setSaved(false);
          startTransition(async () => {
            const result = await updateChatbotSettings(formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            setSaved(true);
          });
        }}
      >
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="botEnabled"
            checked={botEnabled}
            onChange={(e) => setBotEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">
            <span className="font-semibold">Bot ativo globalmente</span>
            <br />
            <span className="text-xs text-ink-faint">
              Desligado, nenhuma conversa recebe resposta automática — tudo cai direto para atendimento humano.
            </span>
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Teto diário de respostas automáticas por telefone
          <input
            type="number"
            name="dailyReplyLimit"
            min={1}
            defaultValue={settings.dailyReplyLimit}
            className="input max-w-[160px]"
          />
          <span className="text-xs font-normal text-ink-faint">
            Limite de respostas do bot de FAQ por número de telefone por dia, para conter custo de API em caso de
            loop ou uso abusivo. Ao atingir o teto, a conversa cai para a resposta padrão de boas-vindas.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Saudação de fallback (opcional)
          <textarea
            name="greetingFallback"
            rows={4}
            defaultValue={settings.greetingFallback ?? ""}
            placeholder="Deixe em branco para usar o texto padrão do sistema"
            className="input"
          />
          <span className="text-xs font-normal text-ink-faint">
            Mensagem enviada quando nenhum outro fluxo do bot reconhece o pedido (ex.: Gemini indisponível ou teto
            diário atingido). Em branco, usa o texto padrão do sistema.
          </span>
        </label>

        {error && <p className="text-xs text-status-negative-text">{error}</p>}
        {saved && !error && <p className="text-xs text-status-positive-text">Configurações salvas.</p>}

        <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
          {isPending ? "Salvando…" : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}
