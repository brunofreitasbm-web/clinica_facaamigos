"use client";

import { useState, useTransition } from "react";
import { testTwilioChatbotResponseAction, type ChatbotTestResult } from "@/app/actions/twilio-chatbot";
import { Bot, Send, Sparkles, CheckCircle2, Copy, ShieldCheck, MessageSquare, AlertCircle } from "lucide-react";

export function TwilioChatbotTestPanel() {
  const [inputMessage, setInputMessage] = useState("Quais planos de saúde a clínica atende?");
  const [mediaUrl, setMediaUrl] = useState("");
  const [simulatedFrom, setSimulatedFrom] = useState("");
  const [result, setResult] = useState<ChatbotTestResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const sampleMessages = [
    "Quais os planos que a clínica atende?",
    "Vocês aceitam Unimed ou Bradesco?",
    "Qual o valor da consulta particular?",
    "Como faço para agendar um atendimento?",
  ];

  const handleTest = (msgToTest?: string) => {
    const text = msgToTest ?? inputMessage;
    if (!text.trim() && !mediaUrl.trim()) return;

    startTransition(async () => {
      const res = await testTwilioChatbotResponseAction(text, mediaUrl.trim() || undefined, simulatedFrom.trim() || undefined);
      setResult(res);
    });
  };

  const copyWebhookUrl = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/api/webhooks/twilio`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="rounded-xl border border-paper-line bg-paper-card p-6 shadow-sm flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink text-base">Chatbot Twilio — Resposta Automática de Convênios</h3>
            <p className="text-xs text-ink-muted">
              Responde instantaneamente pacientes no WhatsApp/SMS com a lista de planos cadastrados no sistema.
            </p>
          </div>
        </div>

        <button
          onClick={copyWebhookUrl}
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-paper-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-line/30 transition-colors"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-ink-muted" />}
          {copied ? "URL Copiada!" : "Copiar URL do Webhook"}
        </button>
      </div>

      {/* Webhook Configuration Note */}
      <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 p-4 text-xs text-ink flex items-start gap-3">
        <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-teal-700 dark:text-teal-300">Integração Twilio Ativa:</span> Cole a URL do Webhook{" "}
          <code className="rounded bg-teal-500/10 px-1 py-0.5 font-mono text-[11px] text-teal-800 dark:text-teal-200">
            /api/webhooks/twilio
          </code>{" "}
          no Console da Twilio (seção <i>&quot;WHEN A MESSAGE COMES IN&quot;</i>) nas configurações do seu número de WhatsApp/SMS.
        </div>
      </div>

      {/* Simulator Interface */}
      <div className="flex flex-col gap-4">
        <label className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-chart" /> Testar Resposta do Chatbot em Tempo Real
        </label>

        {/* Preset Sample Buttons */}
        <div className="flex flex-wrap gap-2">
          {sampleMessages.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputMessage(sample);
                handleTest(sample);
              }}
              className="rounded-full border border-paper-line bg-paper px-3 py-1 text-xs text-ink hover:border-chart hover:text-chart transition-all text-left"
            >
              &quot;{sample}&quot;
            </button>
          ))}
        </div>

        {/* Input & Send Button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
            placeholder="Digite uma mensagem simulada do paciente..."
            className="flex-1 rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-chart focus:outline-none focus:ring-1 focus:ring-chart"
          />
          <button
            type="button"
            onClick={() => handleTest()}
            disabled={isPending || (!inputMessage.trim() && !mediaUrl.trim())}
            className="inline-flex items-center gap-2 rounded-lg bg-chart px-4 py-2.5 text-sm font-medium text-white hover:bg-chart/90 disabled:opacity-50 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
            {isPending ? "Testando..." : "Simular Envío"}
          </button>
        </div>

        {/* URL de mídia opcional — testa o "cadastro assistido por IA"
            (lib/registration-drafts-ingest.ts) simulando o envio de uma
            foto/PDF junto da mensagem, sem precisar de um número real. */}
        <input
          type="text"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="URL pública de uma imagem/PDF para simular anexo (opcional — testa o cadastro assistido por IA)"
          className="rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-xs text-ink focus:border-chart focus:outline-none focus:ring-1 focus:ring-chart"
        />

        {/* Número simulado (E.164) opcional — testa um fluxo de bot já em
            andamento para um telefone específico (ex.: um lead de
            acolhimento de plano de saúde aguardando "PRONTO" ou a escolha
            de horário), em vez de sempre usar o número fixo de teste. */}
        <input
          type="text"
          value={simulatedFrom}
          onChange={(e) => setSimulatedFrom(e.target.value)}
          placeholder="Número simulado em E.164, ex.: +5511999998888 (opcional — testa um fluxo de bot já em andamento nesse telefone)"
          className="rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-xs text-ink focus:border-chart focus:outline-none focus:ring-1 focus:ring-chart"
        />

        {/* Output Result Display */}
        {result && (
          <div className="mt-2 rounded-xl border border-paper-line bg-paper/60 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Resultado da Simulação
              </span>
              {result.intent && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    result.intent === "planos_saude"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                  }`}
                >
                  Intenção: {result.intent === "planos_saude" ? "Planos & Convênios (Reconhecido)" : "Atendimento Geral"}
                </span>
              )}
            </div>

            {result.error ? (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
                {result.error}
              </div>
            ) : (
              <div className="rounded-lg bg-paper border border-paper-line p-3 font-sans text-xs text-ink whitespace-pre-wrap leading-relaxed">
                {result.replyMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
