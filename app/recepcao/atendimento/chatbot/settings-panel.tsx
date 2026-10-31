"use client";

import { useState, useTransition } from "react";
import { createWelcomeMenuContents, updateChatbotSettings } from "./settings-actions";
import { WELCOME_CONTENTS, type WelcomeContentColumn } from "@/lib/welcome-menu-contents-pure";

export type ChatbotSettingsRow = {
  botEnabled: boolean;
  dailyReplyLimit: number;
  greetingFallback: string | null;
  botAutoResumeHours: number | null;
  agendaStatusNote: string | null;
  particularPricesImageUrl: string | null;
  menuContentSids: Record<WelcomeContentColumn, string | null>;
};


function MenuContentsSection({ sids }: { sids: Record<WelcomeContentColumn, string | null> }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = WELCOME_CONTENTS.filter((c) => sids[c.column]).length;
  const allConfigured = configured === WELCOME_CONTENTS.length;

  function run(replace: boolean) {
    if (replace && !window.confirm("Criar novos conteúdos na Twilio e passar a usá-los no lugar dos atuais?")) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await createWelcomeMenuContents(replace);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const parts = [];
      if (result.created.length) parts.push(`Criados: ${result.created.join(", ")}.`);
      if (result.skipped.length) parts.push(`Já existiam: ${result.skipped.join(", ")}.`);
      if (result.failed.length) setError(`Falhou: ${result.failed.map((f) => `${f.label} (${f.error})`).join("; ")}`);
      setMessage(parts.join(" ") || "Nada a criar.");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-4">
      <h4 className="m-0">Menu interativo do WhatsApp</h4>
      <p className="m-0 text-xs text-ink-faint">
        Sem estes conteúdos o menu funciona em texto numerado (a pessoa responde com o número). Com eles, aparecem o botão
        &ldquo;Ver opções&rdquo; e os botões de voltar. São mensagens de sessão: a Meta não precisa aprovar. O botão cria os
        conteúdos na Twilio e guarda os identificadores aqui; é seguro clicar de novo, só cria o que falta.
      </p>
      <ul className="m-0 list-none p-0 text-xs">
        {WELCOME_CONTENTS.map((c) => (
          <li key={c.key} className="flex items-center gap-2 py-0.5">
            <span aria-hidden>{sids[c.column] ? "✅" : "▫️"}</span>
            <span className="font-semibold">{c.label}</span>
            <span className="text-ink-faint">{sids[c.column] ? `…${sids[c.column]!.slice(-6)}` : "texto numerado"}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={isPending || allConfigured} onClick={() => run(false)}>
          {isPending ? "Criando…" : "Criar menu interativo"}
        </button>
        {configured > 0 && (
          <button type="button" className="btn btn-secondary" disabled={isPending} onClick={() => run(true)}>
            Recriar
          </button>
        )}
      </div>
      {error && <p className="m-0 text-xs text-status-negative-text">{error}</p>}
      {message && !error && <p className="m-0 text-xs text-status-positive-text">{message}</p>}
    </div>
  );
}

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

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Situação atual da agenda (aparece no assistente)
          <textarea
            name="agendaStatusNote"
            rows={3}
            maxLength={600}
            defaultValue={settings.agendaStatusNote ?? ""}
            placeholder="Ex.: Agenda em montagem; previsão de início das sessões em novembro. Novas famílias entram na lista de espera."
            className="input"
          />
          <span className="text-xs font-normal text-ink-faint">
            É a única fonte que o assistente usa para responder &ldquo;tem vaga?&rdquo;, &ldquo;qual a previsão?&rdquo; e
            pedidos de lista de espera. Em branco, ele não promete prazo nem vaga e passa a dúvida para a recepção.
            Atualize sempre que a agenda mudar.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Imagem de valores particulares (URL)
          <input
            type="url"
            name="particularPricesImageUrl"
            defaultValue={settings.particularPricesImageUrl ?? ""}
            placeholder="https://… (JPEG ou PNG). Em branco, usa a arte padrão do sistema."
            className="input"
          />
          <span className="text-xs font-normal text-ink-faint">
            Arte enviada na opção Atendimento particular &gt; Valores das sessões. O WhatsApp aceita só JPEG ou PNG, e
            quanto menor o arquivo, mais rápido ela chega (use{" "}
            <code>npx tsx scripts/optimize-chatbot-image.ts arte.png</code>). Ao trocar a arte, use um endereço novo:
            o WhatsApp guarda a imagem pelo endereço. Os preços do texto vêm da tabela de preços do convênio
            Particular; atualize a imagem junto sempre que um valor mudar.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Retomada automática do bot em conversas escaladas (horas)
          <input
            type="number"
            name="botAutoResumeHours"
            min={0}
            defaultValue={settings.botAutoResumeHours ?? 0}
            className="input max-w-[160px]"
          />
          <span className="text-xs font-normal text-ink-faint">
            Quando uma conversa é escalada para um humano e ninguém responde nesse prazo, o bot volta a atender
            sozinho (rodado a cada hora). 0 = desligado — a conversa só reabre manualmente pela recepção, como hoje.
          </span>
        </label>

        {error && <p className="text-xs text-status-negative-text">{error}</p>}
        {saved && !error && <p className="text-xs text-status-positive-text">Configurações salvas.</p>}

        <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
          {isPending ? "Salvando…" : "Salvar configurações"}
        </button>
      </form>

      <div className="mt-6">
        <MenuContentsSection sids={settings.menuContentSids} />
      </div>
    </div>
  );
}
