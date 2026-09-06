"use client";

import { useState, useTransition } from "react";
import { approveEvaluationRequest, rejectEvaluationRequest } from "./whatsapp-requests-actions";
import { getDocumentUrl } from "@/app/recepcao/pacientes/[id]/documents-actions";

export type LlmCheck = {
  guideNumber?: string;
  procedureCode?: string;
  sessionsAuthorized?: number;
  validTo?: string;
} | null;

export type WhatsappRequestRow = {
  id: string;
  childName: string;
  guardianName: string;
  cpfMasked: string;
  insurerName: string;
  cardNumber: string | null;
  laudoDocumentId: string | null;
  guiaDocumentId: string | null;
  llmCheck: LlmCheck;
  createdAt: string;
};

function RequestCard({ request }: { request: WhatsappRequestRow }) {
  const [isPending, startTransition] = useTransition();
  const [decided, setDecided] = useState<"aprovada" | "rejeitada" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function openDocument(documentId: string | null) {
    if (!documentId) return;
    const result = await getDocumentUrl(documentId);
    if (result.success) window.open(result.url, "_blank");
    else setError(result.error);
  }

  if (decided) {
    return (
      <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
        {request.childName} · pedido {decided === "aprovada" ? "aprovado" : "rejeitado"}
      </div>
    );
  }

  return (
    <div className="p-4 rounded bg-white border border-[#e4dfd2] space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{request.childName}</p>
          <p className="text-xs text-[#57606b]">
            Responsável: {request.guardianName} · CPF {request.cpfMasked}
          </p>
          <p className="text-xs text-[#57606b]">
            Convênio: {request.insurerName}
            {request.cardNumber ? ` · Carteirinha ${request.cardNumber}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary text-xs" onClick={() => openDocument(request.laudoDocumentId)}>
            Ver laudo
          </button>
          <button type="button" className="btn btn-secondary text-xs" onClick={() => openDocument(request.guiaDocumentId)}>
            Ver guia
          </button>
        </div>
      </div>

      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await approveEvaluationRequest(request.id, formData);
            if (!result.success) setError(result.error);
            else setDecided("aprovada");
          });
        }}
        className="grid grid-cols-2 gap-2 text-xs"
      >
        <div className="col-span-2 text-[11px] text-[#57606b]">
          Guia extraída automaticamente (confira antes de aprovar):
        </div>
        <input name="guide_number" defaultValue={request.llmCheck?.guideNumber ?? ""} placeholder="Nº da guia" className="input" />
        <input
          name="procedure_code"
          defaultValue={request.llmCheck?.procedureCode ?? "avaliacao"}
          placeholder="Código do procedimento"
          className="input"
        />
        <input
          name="sessions_authorized"
          type="number"
          defaultValue={request.llmCheck?.sessionsAuthorized ?? 1}
          placeholder="Sessões autorizadas"
          className="input"
        />
        <input name="valid_from" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        <input name="valid_to" type="date" defaultValue={request.llmCheck?.validTo ?? ""} className="input" />
        <button type="submit" disabled={isPending} className="btn btn-primary col-span-2">
          {isPending ? "Aprovando…" : "Aprovar e enviar horários"}
        </button>
      </form>

      {!rejecting ? (
        <button type="button" className="text-xs text-red-700 underline" onClick={() => setRejecting(true)}>
          Rejeitar documentos
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            className="input text-xs"
            placeholder="Motivo da rejeição (vai pro responsável)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={isPending || !reason.trim()}
            className="btn btn-secondary text-xs"
            onClick={() =>
              startTransition(async () => {
                const result = await rejectEvaluationRequest(request.id, reason);
                if (!result.success) setError(result.error);
                else setDecided("rejeitada");
              })
            }
          >
            Confirmar rejeição
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function WhatsappRequestsPanel({ requests }: { requests: WhatsappRequestRow[] }) {
  return (
    <section>
      <h6 style={{ color: "var(--color-accent-2-600)" }}>WhatsApp</h6>
      <h1 className="m-0 mb-6">Solicitações de avaliação via WhatsApp</h1>
      {requests.length === 0 ? (
        <p className="text-sm text-ink-faint">Nenhum pedido aguardando aprovação no momento.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </section>
  );
}
