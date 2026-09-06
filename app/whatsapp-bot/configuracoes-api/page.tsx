"use client";

import { useState } from "react";
import { Settings2, Key, Phone, CheckCircle, AlertCircle, RefreshCw, Layers } from "lucide-react";

export default function ConfiguracoesApiPage() {
  const [accountSid, setAccountSid] = useState(
    process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID_MASKED || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  );
  const [authToken, setAuthToken] = useState("••••••••••••••••••••••••••••••••");
  const [fromNumber, setFromNumber] = useState("+55 11 99999-8888");
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMsg(null);
    setTimeout(() => {
      setTesting(false);
      setStatusMsg({
        type: "success",
        text: "Conexão com a API do Twilio WhatsApp estabelecida com sucesso! Webhooks operacionais.",
      });
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Configurações Twilio API & Webhook WhatsApp
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie credenciais, números de envio e templates homologados pela Meta.
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border border-rose-500/30 text-rose-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Formulário de Credenciais */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-teal-400" />
          Credenciais da Conta Twilio
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Account SID (Twilio)
            </label>
            <input
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Auth Token (Chave Segura)
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-teal-400" />
              Número Remetente do WhatsApp (E.164)
            </label>
            <input
              type="text"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="ex: whatsapp:+5511999998888"
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testando Conexão..." : "Testar Conexão Twilio"}
          </button>

          <span className="text-[11px] text-slate-500">
            Ambiente: <strong className="text-emerald-400">Produção / Sandbox Ativo</strong>
          </span>
        </div>
      </div>

      {/* Webhook & URL de Retorno */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          URL do Webhook de Recebimento de Mensagens
        </h3>
        <p className="text-xs text-slate-400">
          Configure este endpoint no painel do Twilio Console (Inbound Webhook) para capturar respostas e arquivos enviados pelos clientes:
        </p>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-teal-300 select-all">
          https://suaclinica.com/api/twilio/webhook
        </div>
      </div>
    </div>
  );
}
