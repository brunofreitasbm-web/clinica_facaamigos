"use client";

import { useMemo, useState, useTransition } from "react";
import { uploadIntakeBatch, reprocessIntakeBatch, approveIntakeLeadsAndStartContact, getIntakeBatchPdfUrl } from "./acolhimento-actions";
import { AcolhimentoLeadDrawer, type LeadRow } from "./acolhimento-lead-drawer";
import { IntakeProfileDialog } from "./intake-profile-dialog";
import { parseIntakeProfile } from "@/lib/insurance-intake-profile";

const CONFIDENCE_THRESHOLD = 0.7;

const BATCH_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando IA",
  processing: "Processando…",
  extracted: "Extraído",
  failed: "Falhou — reprocessar",
};

const BATCH_STATUS_TAG: Record<string, string> = {
  pending: "st-agendada",
  processing: "st-agendada",
  extracted: "st-confirmada",
  failed: "st-falta",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  extracted: "Para revisar",
  approved: "Aprovado",
  awaiting_documents: "Em contato — aguardando docs",
  pending_supervisor: "Documentos para validar",
  awaiting_slot: "Aguardando horário",
  pending_confirmation: "Aguardando confirmação",
  scheduled: "Agendado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const LEAD_STATUS_TAG: Record<string, string> = {
  extracted: "st-agendada",
  approved: "st-agendada",
  awaiting_documents: "st-agendada",
  pending_supervisor: "st-falta",
  awaiting_slot: "st-agendada",
  pending_confirmation: "st-falta",
  scheduled: "st-realizada",
  failed: "st-falta",
  cancelled: "st-cancelada",
};

export type BatchRow = {
  id: string;
  insurerName: string | null;
  detectedInsurerName: string | null;
  status: string;
  warnings: string[];
  error: string | null;
  createdAtLabel: string;
  leadsCount: number;
};

export function AcolhimentosPanel({
  batches,
  leadsByBatch,
  insurers,
  therapists,
  rooms,
}: {
  batches: BatchRow[];
  leadsByBatch: Record<string, LeadRow[]>;
  insurers: { id: string; name: string; intake_extraction_profile: unknown }[];
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [uploadInsurerId, setUploadInsurerId] = useState("auto");
  const [uploadFeedback, setUploadFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [profileDialogInsurerId, setProfileDialogInsurerId] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const allLeads = useMemo(() => Object.values(leadsByBatch).flat(), [leadsByBatch]);
  const openLead = allLeads.find((l) => l.id === openLeadId) ?? null;
  const reviewableLeads = allLeads.filter((l) => l.status === "extracted");

  function handleUpload(formData: FormData) {
    setUploadFeedback(null);
    formData.set("insurer_id", uploadInsurerId);
    startTransition(async () => {
      const res = await uploadIntakeBatch(formData);
      if (res.success) {
        setUploadFeedback({ type: "success", text: "PDF enviado — iniciando extração pela IA..." });
        await reprocessIntakeBatch(res.batchId);
      } else {
        setUploadFeedback({ type: "error", text: res.error });
      }
    });
  }

  function handleReprocess(batchId: string) {
    startTransition(async () => {
      await reprocessIntakeBatch(batchId);
    });
  }

  function handleViewBatchPdf(batchId: string) {
    startTransition(async () => {
      const res = await getIntakeBatchPdfUrl(batchId);
      if (res.success) window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleBulkStartContact() {
    setBulkResult(null);
    startTransition(async () => {
      const { results } = await approveIntakeLeadsAndStartContact(selectedLeadIds);
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      setBulkResult(failed > 0 ? `${ok} contato(s) iniciado(s), ${failed} com erro — veja cada acolhimento para detalhes.` : `${ok} contato(s) iniciado(s) com sucesso.`);
      setSelectedLeadIds([]);
    });
  }

  const filteredBatches = batches.filter((b) => (leadsByBatch[b.id] ?? []).length > 0 || b.status !== "extracted");

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs text-ink-soft">
        Envie o PDF com a relação de pacientes encaminhados pelo convênio — a IA extrai os dados de cada beneficiário
        (paciente, responsável, carteirinha e guia) automaticamente. Confira aqui os documentos extraídos, aprove os
        que estiverem corretos e acompanhe o contato via WhatsApp até o agendamento da 1ª avaliação.
      </p>

      <section className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-ink">Nova remessa</h2>
        <form
          action={(fd) => handleUpload(fd)}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Convênio</label>
            <select value={uploadInsurerId} onChange={(e) => setUploadInsurerId(e.target.value)} className="input mt-1">
              <option value="auto">Detectar pelo PDF</option>
              {insurers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">PDF da relação de encaminhados</label>
            <input type="file" name="file" accept="application/pdf" required className="input mt-1" />
          </div>
          <button type="submit" disabled={isPending} className="rounded-md bg-chart px-4 py-2.5 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50">
            Enviar e extrair
          </button>
          {uploadInsurerId !== "auto" && (
            <button type="button" onClick={() => setProfileDialogInsurerId(uploadInsurerId)} className="text-xs font-semibold text-chart hover:underline">
              Configurar campos deste convênio
            </button>
          )}
        </form>
        {uploadFeedback && (
          <p className={`mt-3 text-xs ${uploadFeedback.type === "success" ? "text-status-positive-text" : "text-status-negative-text"}`}>{uploadFeedback.text}</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Lotes recebidos</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-xs">
            <option value="all">Todos os status</option>
            {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {filteredBatches.length === 0 && <p className="text-sm text-ink-faint">Nenhuma remessa enviada ainda.</p>}

        <div className="flex flex-col gap-4">
          {filteredBatches.map((batch) => {
            const leads = (leadsByBatch[batch.id] ?? []).filter((l) => statusFilter === "all" || l.status === statusFilter);
            return (
              <div key={batch.id} className="rounded-lg border border-paper-line-strong bg-white shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line bg-paper p-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{batch.insurerName ?? batch.detectedInsurerName ?? "Convênio a identificar"}</h3>
                    <p className="text-xs text-ink-soft">
                      {batch.createdAtLabel} · {batch.leadsCount} lead(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`tag-status ${BATCH_STATUS_TAG[batch.status] ?? "st-agendada"}`}>{BATCH_STATUS_LABEL[batch.status] ?? batch.status}</span>
                    <button type="button" onClick={() => handleViewBatchPdf(batch.id)} className="text-xs font-semibold text-chart hover:underline">
                      Ver PDF
                    </button>
                    {(batch.status === "failed" || batch.status === "pending") && (
                      <button type="button" onClick={() => handleReprocess(batch.id)} disabled={isPending} className="text-xs font-semibold text-chart hover:underline disabled:opacity-50">
                        {batch.status === "pending" ? "Forçar Extração IA" : "Reprocessar"}
                      </button>
                    )}
                  </div>
                </div>

                {batch.error && <p className="px-4 pt-3 text-xs text-status-negative-text">{batch.error}</p>}
                {batch.warnings.length > 0 && (
                  <ul className="list-disc space-y-1 px-4 pt-3 pl-8 text-xs text-ink-soft">
                    {batch.warnings.map((w, i) => (
                      <li key={`warning-${i}`}>{w}</li>
                    ))}
                  </ul>
                )}

                {leads.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-ink">
                      <thead className="border-b border-paper-line bg-paper text-ink-faint font-medium uppercase">
                        <tr>
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={leads.every((l) => l.status !== "extracted" || selectedLeadIds.includes(l.id)) && leads.some((l) => l.status === "extracted")}
                              onChange={(e) => {
                                const ids = leads.filter((l) => l.status === "extracted").map((l) => l.id);
                                setSelectedLeadIds((prev) => (e.target.checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))));
                              }}
                              className="rounded border-paper-line-strong"
                            />
                          </th>
                          <th className="p-3">Paciente</th>
                          <th className="p-3">Nasc.</th>
                          <th className="p-3">Responsável</th>
                          <th className="p-3">Telefone</th>
                          <th className="p-3">Carteirinha</th>
                          <th className="p-3">Terapias / Procedimentos</th>
                          <th className="p-3">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-paper-line">
                        {leads.map((lead) => {
                          const hasLowConfidence = Object.entries(lead.confidence).some(([, v]) => v < CONFIDENCE_THRESHOLD);
                          return (
                            <tr key={lead.id} className="hover:bg-paper/60">
                              <td className="p-3 text-center">
                                {lead.status === "extracted" && (
                                  <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} className="rounded border-paper-line-strong" />
                                )}
                              </td>
                              <td className={`p-3 font-semibold ${hasLowConfidence ? "text-status-negative-text" : "text-ink"}`}>
                                {lead.patient_full_name || "—"}
                                {lead.duplicate_patient_id && <span className="ml-1.5 tag-status st-agendada">Já cadastrado</span>}
                              </td>
                              <td className="p-3 text-ink-soft">{lead.patient_birth_date || "—"}</td>
                              <td className="p-3 text-ink-soft">{lead.guardian_full_name || "—"}</td>
                              <td className="p-3 text-ink-soft">{lead.phone_e164 || "—"}</td>
                              <td className="p-3 font-mono text-[11px] text-ink-soft">{lead.card_number || "—"}</td>
                              <td className="p-3 text-ink-soft max-w-[200px] truncate" title={lead.procedure_code || "—"}>
                                {lead.procedure_code || "—"}
                              </td>
                              <td className="p-3">
                                <span className={`tag-status ${LEAD_STATUS_TAG[lead.status] ?? "st-agendada"}`}>{LEAD_STATUS_LABEL[lead.status] ?? lead.status}</span>
                              </td>
                              <td className="p-3 text-right">
                                <button type="button" onClick={() => setOpenLeadId(lead.id)} className="text-xs font-semibold text-chart hover:underline">
                                  {lead.status === "pending_supervisor" ? "Validar documentos" : "Revisar"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-paper-line-strong bg-white px-5 py-3 shadow-lg">
          <span className="text-xs text-ink-soft">{selectedLeadIds.length} selecionado(s)</span>
          <button type="button" disabled={isPending} onClick={handleBulkStartContact} className="rounded-full bg-chart px-4 py-2 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50">
            Iniciar contato ({selectedLeadIds.length})
          </button>
        </div>
      )}

      {bulkResult && <p className="text-xs text-ink-soft">{bulkResult}</p>}

      {reviewableLeads.length === 0 && batches.length === 0 && (
        <p className="text-sm text-ink-faint">Nenhum acolhimento aguardando revisão no momento.</p>
      )}

      {openLead && <AcolhimentoLeadDrawer lead={openLead} therapists={therapists} rooms={rooms} onClose={() => setOpenLeadId(null)} />}

      {profileDialogInsurerId && (
        <IntakeProfileDialog
          insurerId={profileDialogInsurerId}
          insurerName={insurers.find((i) => i.id === profileDialogInsurerId)?.name ?? ""}
          initialProfile={parseIntakeProfile(insurers.find((i) => i.id === profileDialogInsurerId)?.intake_extraction_profile)}
          onClose={() => setProfileDialogInsurerId(null)}
        />
      )}
    </div>
  );
}
