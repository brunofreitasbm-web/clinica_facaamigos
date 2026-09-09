"use client";

import React, { useState, useEffect } from "react";
import { Send, MessageSquare, PhoneCall, CheckCircle2, AlertTriangle, X, Loader2, Sparkles } from "lucide-react";
import { sendTwilioNotificationAction, checkTwilioStatusAction } from "@/app/actions/twilio";

interface TwilioSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  patientName?: string;
  guardianName?: string;
  patientId?: string;
}

export function TwilioSendModal({
  isOpen,
  onClose,
  defaultPhone = "",
  patientName = "Paciente",
  guardianName = "Responsável",
  patientId,
}: TwilioSendModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusInfo, setStatusInfo] = useState<{ configured: boolean; accountSid: string | null } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (defaultPhone) {
      queueMicrotask(() => setPhone(defaultPhone));
    }
  }, [defaultPhone]);

  useEffect(() => {
    if (isOpen) {
      checkTwilioStatusAction().then((st) => setStatusInfo(st));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const applyTemplate = (templateType: "reminder" | "absence" | "general") => {
    if (templateType === "reminder") {
      setMessage(`Olá ${guardianName}! Confirmamos a sessão de ${patientName} agendada para amanhã. Por favor, responda 1 para CONFIRMAR ou 2 para REAGENDAR. FaçaAmigos - Centro de Terapia Comportamental.`);
    } else if (templateType === "absence") {
      setMessage(`Olá ${guardianName}. Identificamos a ausência do paciente ${patientName} na sessão de hoje. Entre em contato com a recepção para justificativa ou reagendamento.`);
    } else {
      setMessage(`Olá ${guardianName}! Comunicamos um aviso importante referente ao acompanhamento de ${patientName}. Qualquer dúvida estamos à disposição.`);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!phone.trim()) {
      setFeedback({ type: "error", text: "Por favor, informe o número de telefone de destino." });
      return;
    }

    if (!message.trim()) {
      setFeedback({ type: "error", text: "Digite o texto da mensagem a ser enviada." });
      return;
    }

    setIsSending(true);

    try {
      const res = await sendTwilioNotificationAction({
        to: phone,
        message,
        channel,
        patientId,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Mensagem enviada com sucesso via ${channel.toUpperCase()}! ID: ${res.messageId}`,
        });
        setMessage("");
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Ocorreu um erro ao enviar a mensagem via Twilio.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao conectar com Twilio.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Envio de Notificação (Twilio)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Para: <span className="font-medium text-slate-700 dark:text-slate-300">{patientName}</span> ({guardianName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status da Conexão */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-slate-500 dark:text-slate-400">Status Twilio:</span>
            {statusInfo?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Conectado ({statusInfo.accountSid})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Pendente de Configuração
              </span>
            )}
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSend} className="mt-4 space-y-4">
          {/* Seletor de Canal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Canal de Envio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition-all border ${
                  channel === "whatsapp"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                <MessageSquare className="h-4 w-4" /> WhatsApp API
              </button>
              <button
                type="button"
                onClick={() => setChannel("sms")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-semibold transition-all border ${
                  channel === "sms"
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                <PhoneCall className="h-4 w-4" /> SMS Direto
              </button>
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Telefone do Destinatário
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Modelos Rápidos */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Modelos de Mensagem
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyTemplate("absence")}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Aviso Ausência
              </button>
              <button
                type="button"
                onClick={() => applyTemplate("general")}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Comunicado Geral
              </button>
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mensagem
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite o conteúdo da notificação..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Feedback Toast Inline */}
          {feedback && (
            <div
              className={`rounded-xl p-3 text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-md shadow-red-600/20"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando via Twilio...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Disparar Mensagem
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
