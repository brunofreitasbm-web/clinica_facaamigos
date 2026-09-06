"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  User,
  Phone,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  getPendingAnamnesisRequestsAction,
  approveAnamnesisDocumentAction,
  rejectAnamnesisDocumentAction,
  type AnamnesisRequestItem,
} from "@/app/actions/anamnesis-chatbot";

export function AnamnesisValidationPanel() {
  const [requests, setRequests] = useState<AnamnesisRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRequests = async () => {
    const res = await getPendingAnamnesisRequestsAction();
    if (res.success && res.requests) {
      setRequests(res.requests);
    }
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchRequests();
    });
  }, []);

  const handleApprove = async (id: string) => {
    setActionId(id);
    setFeedback(null);
    const res = await approveAnamnesisDocumentAction(id);
    setActionId(null);

    if (res.success) {
      setFeedback({
        type: "success",
        text: "Documentação APROVADA! Horários de agendamento enviados automaticamente via WhatsApp do responsável.",
      });
      fetchRequests();
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Erro ao aprovar documentação.",
      });
    }
  };

  const handleRejectSubmit = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionId(id);
    setFeedback(null);
    const res = await rejectAnamnesisDocumentAction(id, rejectReason.trim());
    setActionId(null);
    setRejectingId(null);
    setRejectReason("");

    if (res.success) {
      setFeedback({
        type: "success",
        text: "Solicitação rejeitada. Notificação enviada ao responsável via WhatsApp com o motivo do ajuste.",
      });
      fetchRequests();
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Erro ao rejeitar documentação.",
      });
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pendente_supervisor");
  const processedRequests = requests.filter((r) => r.status !== "pendente_supervisor");

  return (
    <div className="space-y-6">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-900/40 via-emerald-950/30 to-slate-900 border border-teal-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Validação de Documentos de Anamnese (WhatsApp Bot)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Twilio Ingest
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Valide laudos e guias recebidos via robô de WhatsApp para liberar horários de agendamento.
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar Fila
        </button>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Lista de Requisições Pendentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Pendentes de Validação ({pendingRequests.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
            Carregando triagens pendentes...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <p className="text-sm font-medium text-slate-300">Nenhum documento pendente no momento!</p>
            <p className="text-xs text-slate-500">
              Todas as triagens de anamnese recebidas via WhatsApp já foram processadas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-4 shadow-sm"
              >
                {/* Dados da Criança e Responsável */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-base">{req.child_name}</h4>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Anamnese
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1 text-xs text-slate-400">
                      <p className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        Responsável: <strong className="text-slate-200">{req.guardian_name}</strong> (CPF: {req.guardian_cpf})
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        Contato: <span className="text-teal-400 font-mono">{req.guardian_phone}</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* PDFs Anexados */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  {req.laudo_pdf_url ? (
                    <a
                      href={req.laudo_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs text-teal-300 group transition"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="truncate font-medium">Laudo Médico.pdf</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>Sem Laudo</span>
                    </div>
                  )}

                  {req.guia_pdf_url ? (
                    <a
                      href={req.guia_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs text-teal-300 group transition"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="truncate font-medium">Guia Plano.pdf</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>Sem Guia</span>
                    </div>
                  )}
                </div>

                {/* Modal/Input para Rejeição de Documento */}
                {rejectingId === req.id ? (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 space-y-2.5">
                    <p className="text-xs font-medium text-rose-300">
                      Motivo da Recusa (enviado via WhatsApp):
                    </p>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Ex: O PDF do laudo está ilegível ou expirado..."
                      className="w-full p-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleRejectSubmit(req.id)}
                        disabled={actionId === req.id || !rejectReason.trim()}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
                      >
                        Confirmar Rejeição
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Botões de Ação do Supervisor */
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionId === req.id}
                      className="flex-1 py-2 px-3 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {actionId === req.id ? "Enviando..." : "Aprovar e Liberar Horários"}
                    </button>

                    <button
                      onClick={() => setRejectingId(req.id)}
                      disabled={actionId === req.id}
                      className="py-2 px-3 text-xs font-medium rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico Recente de Processados */}
      {processedRequests.length > 0 && (
        <div className="pt-6 border-t border-slate-800/80 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Histórico Recente ({processedRequests.length})
          </h3>
          <div className="divide-y divide-slate-800/60 rounded-xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
            {processedRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      req.status === "agendado" || req.status === "aprovado"
                        ? "bg-emerald-400"
                        : "bg-rose-400"
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-slate-200">{req.child_name}</span>
                    <span className="text-slate-500 ml-2">({req.guardian_name})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                      req.status === "agendado"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : req.status === "aprovado"
                        ? "bg-teal-500/20 text-teal-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {req.status === "agendado"
                      ? "Agendado"
                      : req.status === "aprovado"
                      ? "Aguardando Seleção de Horário"
                      : "Rejeitado"}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(req.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
