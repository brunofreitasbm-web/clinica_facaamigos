"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, XCircle, ExternalLink, User, Phone, CreditCard } from "lucide-react";
import {
  getPendingAnamnesisRequestsAction,
  approveAnamnesisDocumentAction,
  rejectAnamnesisDocumentAction,
  type AnamnesisRequestItem,
} from "@/app/actions/anamnesis-chatbot";

/**
 * Menu flutuante de validação de documentos de uma solicitação de
 * anamnese/avaliação vinda do WhatsApp — mesma ação de aprovar/rejeitar do
 * AnamnesisValidationPanel, só que ancorada no card da fila "Aguardando
 * agendamento" pra o supervisor aprovar sem sair da tela do calendário.
 */
export function AnamnesisDocumentPopover({
  requestId,
  onClose,
  onResolved,
}: {
  requestId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [request, setRequest] = useState<AnamnesisRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPendingAnamnesisRequestsAction().then((res) => {
      if (cancelled) return;
      if (res.success && res.requests) {
        setRequest(res.requests.find((r) => r.id === requestId) ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    const res = await approveAnamnesisDocumentAction(requestId);
    setBusy(false);
    if (res.success) {
      onResolved();
    } else {
      setError(res.error || "Erro ao aprovar documentação.");
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setBusy(true);
    setError(null);
    const res = await rejectAnamnesisDocumentAction(requestId, rejectReason.trim());
    setBusy(false);
    if (res.success) {
      onResolved();
    } else {
      setError(res.error || "Erro ao rejeitar documentação.");
    }
  }

  return (
    <div
      className="absolute left-0 top-full z-20 mt-2 w-80 rounded-md border border-paper-line-strong bg-white p-3.5 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Validar documentação</p>
        <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink">
          ×
        </button>
      </div>

      {loading && <p className="mt-2 text-xs text-ink-faint">Carregando…</p>}

      {!loading && !request && <p className="mt-2 text-xs text-ink-faint">Solicitação não encontrada.</p>}

      {!loading && request && (
        <div className="mt-2.5 flex flex-col gap-3">
          <div className="space-y-1 text-xs text-ink-faint">
            <p className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Responsável: <strong className="font-semibold text-ink-soft">{request.guardian_name}</strong> (CPF: {request.guardian_cpf})
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span className="font-mono text-ink-soft">{request.guardian_phone}</span>
            </p>
            {request.carteirinha_numero && (
              <p className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-accent" />
                Carteirinha: <span className="font-mono font-semibold text-accent">{request.carteirinha_numero}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-paper-line pt-2.5">
            {request.laudo_pdf_url ? (
              <a
                href={request.laudo_pdf_url}
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
            {request.guia_pdf_url ? (
              <a
                href={request.guia_pdf_url}
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
            {request.carteirinha_frente_url ? (
              <a
                href={request.carteirinha_frente_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2 text-xs font-medium text-accent no-underline"
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">Carteirinha (frente)</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink" />
              </a>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-paper-line px-2.5 py-2 text-xs text-ink-faint">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Sem carteirinha (frente)</span>
              </div>
            )}
            {request.carteirinha_verso_url && request.carteirinha_verso_url !== request.carteirinha_frente_url ? (
              <a
                href={request.carteirinha_verso_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper px-2.5 py-2 text-xs font-medium text-accent no-underline"
              >
                <span className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">Carteirinha (verso)</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink" />
              </a>
            ) : null}
          </div>

          {error && <p className="text-xs text-status-negative-text">{error}</p>}

          {rejecting ? (
            <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-2.5">
              <p className="text-xs font-semibold text-red-700">Motivo da recusa:</p>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: laudo ilegível ou expirado…"
                className="input text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason("");
                  }}
                  className="btn btn-ghost text-xs py-1 px-2.5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={busy || !rejectReason.trim()}
                  className="btn text-xs py-1 px-3 bg-red-600 text-white hover:bg-red-700"
                >
                  Confirmar rejeição
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleApprove} disabled={busy} className="btn btn-primary flex-1 text-xs py-2">
                <CheckCircle2 className="h-4 w-4" />
                {busy ? "Enviando…" : "Aprovar e liberar horários"}
              </button>
              <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="btn btn-secondary text-xs py-2">
                <XCircle className="h-4 w-4" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
