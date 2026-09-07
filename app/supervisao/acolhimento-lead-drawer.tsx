"use client";

import { useState, useTransition } from "react";
import {
  updateIntakeLeadFields,
  approveIntakeLeadsAndStartContact,
  reviewIntakeLeadFile,
  approveIntakeLeadDocuments,
  rejectIntakeLeadDocuments,
  resendIntakeSlots,
  cancelIntakeLead,
  retryIntakeLead,
  getIntakeFileUrl,
} from "./acolhimento-actions";

const CONFIDENCE_THRESHOLD = 0.7;

const REJECT_REASONS = [
  { value: "ilegivel", label: "Ilegível" },
  { value: "incompleto", label: "Incompleto" },
  { value: "vencido", label: "Vencido" },
  { value: "documento_errado", label: "Documento errado" },
  { value: "outro", label: "Outro" },
];

export type LeadFileRow = {
  id: string;
  original_name: string | null;
  mime_type: string;
  kind: "laudo" | "guia" | "outro" | null;
  review_status: "pending" | "approved" | "rejected";
};

export type LeadRow = {
  id: string;
  batch_id: string;
  status: string;
  status_reason: string | null;
  rejection_count: number;
  patient_full_name: string | null;
  patient_birth_date: string | null;
  patient_cpf: string | null;
  patient_sexo: string | null;
  patient_cid: string | null;
  guardian_full_name: string | null;
  guardian_cpf: string | null;
  guardian_relationship: string | null;
  guardian_email: string | null;
  phone_e164: string | null;
  card_number: string | null;
  plan_name: string | null;
  card_valid_until: string | null;
  guide_number: string | null;
  procedure_code: string | null;
  sessions_authorized: number | null;
  valid_from: string | null;
  valid_to: string | null;
  authorization_password: string | null;
  confidence: Record<string, number>;
  warnings: string[];
  duplicate_patient_id: string | null;
  duplicate_reason: string | null;
  offered_slots: { index: number; label: string }[] | null;
  files: LeadFileRow[];
};

function fieldClass(key: string, confidence: Record<string, number>): string {
  const conf = confidence[key];
  if (conf !== undefined && conf < CONFIDENCE_THRESHOLD) {
    return "input mt-1 border-status-negative-text bg-status-negative-text/5";
  }
  return "input mt-1";
}

function Field({ label, name, defaultValue, confidence }: { label: string; name: string; defaultValue: string; confidence: Record<string, number> }) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</label>
      <input name={name} defaultValue={defaultValue} className={fieldClass(name, confidence)} />
    </div>
  );
}

export function AcolhimentoLeadDrawer({
  lead,
  therapists,
  rooms,
  onClose,
}: {
  lead: LeadRow;
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState(therapists[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");

  function saveFields(form: HTMLFormElement) {
    const data = new FormData(form);
    const patch: Record<string, string> = {};
    for (const [key, value] of data.entries()) patch[key] = String(value);
    startTransition(async () => {
      const res = await updateIntakeLeadFields(lead.id, patch);
      setFeedback(res.success ? { type: "success", text: "Dados salvos." } : { type: "error", text: res.error });
    });
  }

  function handleFileAction(fileId: string, patch: { kind?: "laudo" | "guia" | "outro"; decision?: "approved" | "rejected" }) {
    startTransition(async () => {
      const res = await reviewIntakeLeadFile(fileId, patch);
      if (!res.success) setFeedback({ type: "error", text: res.error });
    });
  }

  function handleViewFile(fileId: string) {
    startTransition(async () => {
      const res = await getIntakeFileUrl(fileId);
      if (res.success) window.open(res.url, "_blank", "noopener,noreferrer");
      else setFeedback({ type: "error", text: res.error });
    });
  }

  function handleStartContact() {
    startTransition(async () => {
      const res = await approveIntakeLeadsAndStartContact([lead.id]);
      const outcome = res.results[0];
      setFeedback(
        outcome?.success
          ? { type: "success", text: "Contato iniciado — mensagem enviada por WhatsApp." }
          : { type: "error", text: outcome?.error ?? "Não foi possível iniciar o contato." },
      );
    });
  }

  function handleApproveDocs() {
    startTransition(async () => {
      const res = await approveIntakeLeadDocuments(lead.id, therapistId, roomId);
      setFeedback(res.success ? { type: "success", text: "Documentos aprovados — horários enviados por WhatsApp." } : { type: "error", text: res.error });
    });
  }

  function handleRejectDocs() {
    if (!rejectReason) return;
    startTransition(async () => {
      const res = await rejectIntakeLeadDocuments(lead.id, rejectReason);
      setRejectReason(null);
      setFeedback(res.success ? { type: "success", text: "Reenvio solicitado por WhatsApp." } : { type: "error", text: res.error });
    });
  }

  function handleResendSlots() {
    startTransition(async () => {
      const res = await resendIntakeSlots(lead.id);
      setFeedback(res.success ? { type: "success", text: "Horários reenviados." } : { type: "error", text: res.error });
    });
  }

  function handleCancel() {
    if (!confirm("Cancelar este acolhimento?")) return;
    startTransition(async () => {
      const res = await cancelIntakeLead(lead.id);
      setFeedback(res.success ? { type: "success", text: "Acolhimento cancelado." } : { type: "error", text: res.error });
      if (res.success) onClose();
    });
  }

  function handleRetry() {
    startTransition(async () => {
      const res = await retryIntakeLead(lead.id);
      setFeedback(res.success ? { type: "success", text: "Pronto para tentar de novo." } : { type: "error", text: res.error });
    });
  }

  const pendingFiles = lead.files.filter((f) => f.review_status === "pending");
  const approvedFiles = lead.files.filter((f) => f.review_status === "approved");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">{lead.patient_full_name || "Acolhimento"}</h3>
          <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-ink">
            Fechar ✕
          </button>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-md border p-3 text-xs ${feedback.type === "success" ? "border-status-positive-text/40 bg-status-positive-soft/40 text-status-positive-text" : "border-status-negative-text/40 bg-status-negative-soft/40 text-status-negative-text"}`}>
            {feedback.text}
          </div>
        )}

        {lead.duplicate_patient_id && (
          <div className="mb-4 rounded-md border border-gold bg-gold/10 p-3 text-xs text-ink">
            ⚠️ Possível cadastro já existente ({lead.duplicate_reason === "cpf" ? "mesmo CPF" : lead.duplicate_reason === "phone" ? "mesmo telefone" : "nome e nascimento iguais"}) — ao iniciar contato, este paciente será vinculado ao cadastro existente.
          </div>
        )}

        {lead.warnings.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 rounded-md border border-gold/40 bg-gold/5 p-3 pl-6 text-xs text-ink-soft">
            {lead.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {(lead.status === "extracted" || lead.status === "failed") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveFields(e.currentTarget);
            }}
            className="mb-6 flex flex-col gap-4"
          >
            <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-paper-line-strong p-3">
              <legend className="px-1 text-xs font-semibold text-ink-soft">Paciente</legend>
              <Field label="Nome completo" name="patient_full_name" defaultValue={lead.patient_full_name ?? ""} confidence={lead.confidence} />
              <Field label="Nascimento (YYYY-MM-DD)" name="patient_birth_date" defaultValue={lead.patient_birth_date ?? ""} confidence={lead.confidence} />
              <Field label="CPF" name="patient_cpf" defaultValue={lead.patient_cpf ?? ""} confidence={lead.confidence} />
              <Field label="CID" name="patient_cid" defaultValue={lead.patient_cid ?? ""} confidence={lead.confidence} />
            </fieldset>
            <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-paper-line-strong p-3">
              <legend className="px-1 text-xs font-semibold text-ink-soft">Responsável</legend>
              <Field label="Nome completo" name="guardian_full_name" defaultValue={lead.guardian_full_name ?? ""} confidence={lead.confidence} />
              <Field label="Telefone (WhatsApp)" name="phone_e164" defaultValue={lead.phone_e164 ?? ""} confidence={lead.confidence} />
              <Field label="CPF" name="guardian_cpf" defaultValue={lead.guardian_cpf ?? ""} confidence={lead.confidence} />
              <Field label="Parentesco" name="guardian_relationship" defaultValue={lead.guardian_relationship ?? ""} confidence={lead.confidence} />
            </fieldset>
            <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-paper-line-strong p-3">
              <legend className="px-1 text-xs font-semibold text-ink-soft">Convênio / guia</legend>
              <Field label="Nº carteirinha" name="card_number" defaultValue={lead.card_number ?? ""} confidence={lead.confidence} />
              <Field label="Nº guia" name="guide_number" defaultValue={lead.guide_number ?? ""} confidence={lead.confidence} />
              <Field label="Código do procedimento" name="procedure_code" defaultValue={lead.procedure_code ?? ""} confidence={lead.confidence} />
              <Field label="Sessões autorizadas" name="sessions_authorized" defaultValue={lead.sessions_authorized?.toString() ?? ""} confidence={lead.confidence} />
              <Field label="Vigência início" name="valid_from" defaultValue={lead.valid_from ?? ""} confidence={lead.confidence} />
              <Field label="Vigência fim" name="valid_to" defaultValue={lead.valid_to ?? ""} confidence={lead.confidence} />
            </fieldset>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs font-semibold text-ink hover:bg-paper/60 disabled:opacity-50">
                Salvar alterações
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleStartContact}
                className="rounded-md bg-chart px-3 py-2 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50"
              >
                Iniciar contato por WhatsApp
              </button>
            </div>
          </form>
        )}

        {lead.status !== "extracted" && lead.status !== "failed" && (
          <div className="mb-6 rounded-md border border-paper-line-strong bg-paper/60 p-3 text-xs text-ink-soft">
            <p>
              <strong>Responsável:</strong> {lead.guardian_full_name || "—"} · {lead.phone_e164 || "—"}
            </p>
            <p>
              <strong>Status:</strong> {lead.status}
              {lead.status_reason ? ` — ${lead.status_reason}` : ""}
            </p>
          </div>
        )}

        {(lead.status === "awaiting_documents" || lead.status === "pending_supervisor") && (
          <div className="mb-6">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Documentos recebidos</h4>
            {lead.files.length === 0 && <p className="text-xs text-ink-faint">Nenhum arquivo recebido ainda.</p>}
            <div className="flex flex-col gap-2">
              {lead.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper/40 p-2 text-xs">
                  <button type="button" onClick={() => handleViewFile(file.id)} className="truncate text-left text-chart hover:underline">
                    {file.original_name || "arquivo"}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <select
                      defaultValue={file.kind ?? ""}
                      onChange={(e) => handleFileAction(file.id, { kind: e.target.value as "laudo" | "guia" | "outro" })}
                      className="rounded border border-paper-line-strong bg-white px-1.5 py-1 text-[11px]"
                    >
                      <option value="">Tipo…</option>
                      <option value="laudo">Laudo</option>
                      <option value="guia">Guia</option>
                      <option value="outro">Outro</option>
                    </select>
                    {file.review_status === "pending" ? (
                      <>
                        <button type="button" onClick={() => handleFileAction(file.id, { decision: "approved" })} className="rounded bg-status-positive-soft px-2 py-1 font-semibold text-status-positive-text">
                          ✓
                        </button>
                        <button type="button" onClick={() => handleFileAction(file.id, { decision: "rejected" })} className="rounded bg-status-negative-soft px-2 py-1 font-semibold text-status-negative-text">
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className={`tag-status ${file.review_status === "approved" ? "st-confirmada" : "st-cancelada"}`}>
                        {file.review_status === "approved" ? "Aprovado" : "Rejeitado"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lead.status === "pending_supervisor" && (
          <div className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Agendamento da avaliação</h4>
            <div className="grid grid-cols-2 gap-2">
              <select value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="input">
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={isPending || approvedFiles.length === 0}
              onClick={handleApproveDocs}
              className="rounded-md bg-chart px-3 py-2 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50"
              title={approvedFiles.length === 0 ? "Aprove ao menos um arquivo antes" : undefined}
            >
              Aprovar documentos e enviar horários
            </button>

            <div className="flex flex-wrap items-center gap-2 border-t border-paper-line pt-3">
              <span className="text-xs text-ink-soft">Pedir reenvio:</span>
              {REJECT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRejectReason(r.value)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${rejectReason === r.value ? "border-chart bg-chart/10 text-chart" : "border-paper-line-strong text-ink-soft"}`}
                >
                  {r.label}
                </button>
              ))}
              <button type="button" disabled={!rejectReason || isPending} onClick={handleRejectDocs} className="rounded-md bg-status-negative-soft px-3 py-1.5 text-xs font-semibold text-status-negative-text disabled:opacity-50">
                Confirmar rejeição
              </button>
            </div>
          </div>
        )}

        {lead.status === "awaiting_slot" && lead.offered_slots && (
          <div className="mb-6 rounded-md border border-paper-line-strong bg-paper/60 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Horários oferecidos</h4>
            <ul className="mb-3 space-y-1 text-xs text-ink-soft">
              {lead.offered_slots.map((s) => (
                <li key={s.index}>
                  {s.index} — {s.label}
                </li>
              ))}
            </ul>
            <button type="button" disabled={isPending} onClick={handleResendSlots} className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper/60 disabled:opacity-50">
              Reenviar horários
            </button>
          </div>
        )}

        <div className="mt-6 flex gap-2 border-t border-paper-line pt-4">
          {lead.status === "failed" && (
            <button type="button" disabled={isPending} onClick={handleRetry} className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-xs font-semibold text-ink hover:bg-paper/60 disabled:opacity-50">
              Tentar novamente
            </button>
          )}
          {!["scheduled", "cancelled"].includes(lead.status) && (
            <button type="button" disabled={isPending} onClick={handleCancel} className="rounded-md border border-status-negative-text/40 px-3 py-2 text-xs font-semibold text-status-negative-text hover:bg-status-negative-soft/30 disabled:opacity-50">
              Cancelar acolhimento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
