"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  User,
  Phone,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  getPendingAnamnesisRequestsAction,
  approveAnamnesisDocumentAction,
  rejectAnamnesisDocumentAction,
  createMockWhatsAppAnamnesisRequestAction,
  type AnamnesisRequestItem,
} from "@/app/actions/anamnesis-chatbot";

export function AnamnesisValidationPanel() {
  const [requests, setRequests] = useState<AnamnesisRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingMock, setCreatingMock] = useState(false);
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

  const handleCreateMock = async () => {
    setCreatingMock(true);
    setFeedback(null);
    const res = await createMockWhatsAppAnamnesisRequestAction();
    setCreatingMock(false);

    if (res.success) {
      setFeedback({
        type: "success",
        text: "Paciente fictício 'Lucas Gabriel Santana' adicionado à fila com dados do WhatsApp!",
      });
      fetchRequests();
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Erro ao criar paciente fictício.",
      });
    }
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
        text: "Documentação aprovada! Horários de agendamento enviados automaticamente via WhatsApp do responsável.",
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
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          Valide laudos e guias recebidos via robô de WhatsApp para liberar horários de agendamento.
        </p>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleCreateMock}
            disabled={creatingMock || loading}
            className="btn btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Phone className="h-3.5 w-3.5" />
            {creatingMock ? "Criando..." : "+ Gerar Paciente WhatsApp (Teste)"}
          </button>
          <button
            type="button"
            onClick={fetchRequests}
            disabled={loading}
            className="btn btn-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar fila
          </button>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-faint hover:text-ink">
            ×
          </button>
        </div>
      )}

      {/* Lista de Requisições Pendentes */}
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          <Clock className="h-3.5 w-3.5 text-accent-2" />
          Pendentes de validação ({pendingRequests.length})
        </h3>

        {loading ? (
          <div className="card items-center text-center text-xs text-ink-faint">
            Carregando triagens pendentes...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="card items-center gap-3 text-center py-6">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 opacity-80" />
            <div>
              <p className="text-sm font-medium text-ink">Nenhum documento pendente no momento!</p>
              <p className="text-xs text-ink-faint mt-1">
                Todas as triagens de anamnese recebidas via WhatsApp já foram processadas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateMock}
              disabled={creatingMock}
              className="btn btn-primary text-xs py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white mt-1"
            >
              <Phone className="h-4 w-4" />
              {creatingMock ? "Gerando..." : "Criar Paciente Fictício (WhatsApp)"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="card gap-3.5">
                {/* Dados da Criança e Responsável */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-ink">{req.child_name}</h4>
                      <span className="tag tag-accent-2">Anamnese</span>
                    </div>
                    <div className="mt-1.5 space-y-1 text-xs text-ink-faint">
                      <p className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Responsável: <strong className="font-semibold text-ink-soft">{req.guardian_name}</strong> (CPF: {req.guardian_cpf})
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        Contato: <span className="font-mono text-ink-soft">{req.guardian_phone}</span>
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                    {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* PDFs Anexados */}
                <div className="grid grid-cols-2 gap-2 border-t border-paper-line pt-3">
                  {req.laudo_pdf_url ? (
                    <a
                      href={req.laudo_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2 text-xs font-medium text-accent no-underline"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">Laudo Médico.pdf</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-paper-line px-2.5 py-2 text-xs text-ink-faint">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>Sem laudo</span>
                    </div>
                  )}

                  {req.guia_pdf_url ? (
                    <a
                      href={req.guia_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2 text-xs font-medium text-accent no-underline"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">Guia Plano.pdf</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-paper-line px-2.5 py-2 text-xs text-ink-faint">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>Sem guia</span>
                    </div>
                  )}
                </div>

                {/* Rejeição de Documento */}
                {rejectingId === req.id ? (
                  <div className="flex flex-col gap-2.5 rounded-md border border-red-300 bg-red-50 p-3">
                    <p className="text-xs font-semibold text-red-700">Motivo da recusa (enviado via WhatsApp):</p>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Ex: O PDF do laudo está ilegível ou expirado..."
                      className="input text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="btn btn-ghost text-xs py-1 px-2.5"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectSubmit(req.id)}
                        disabled={actionId === req.id || !rejectReason.trim()}
                        className="btn text-xs py-1 px-3 bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirmar rejeição
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Ações rápidas do supervisor */
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprove(req.id)}
                      disabled={actionId === req.id}
                      className="btn btn-primary flex-1 text-xs py-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {actionId === req.id ? "Enviando..." : "Aprovar e liberar horários"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRejectingId(req.id)}
                      disabled={actionId === req.id}
                      className="btn btn-secondary text-xs py-2"
                    >
                      <XCircle className="h-4 w-4" />
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
        <div className="flex flex-col gap-3 border-t border-paper-line pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Histórico recente ({processedRequests.length})
          </h3>
          <div className="divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line-strong bg-paper/60">
            {processedRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      req.status === "agendado" || req.status === "aprovado" ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-ink">{req.child_name}</span>
                    <span className="ml-2 text-ink-faint">({req.guardian_name})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`tag-status ${
                      req.status === "agendado" ? "st-realizada" : req.status === "aprovado" ? "st-confirmada" : "st-falta"
                    }`}
                  >
                    {req.status === "agendado"
                      ? "Agendado"
                      : req.status === "aprovado"
                      ? "Aguardando seleção de horário"
                      : "Rejeitado"}
                  </span>
                  <span className="text-ink-faint text-[11px]">
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
