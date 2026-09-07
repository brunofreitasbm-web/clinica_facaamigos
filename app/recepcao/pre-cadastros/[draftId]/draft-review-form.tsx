"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateRegistrationDraft, rejectRegistrationDraft, reprocessRegistrationDraft, getDraftFileUrl } from "../actions";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import type { DocumentExtraction } from "@/lib/document-extraction";

type FileRow = { id: string; original_name: string | null; mime_type: string; detected_type: string | null };
type Insurer = { id: string; name: string };
type DuplicateCandidate = { id: string; full_name: string; birth_date: string };

const CONFIDENCE_THRESHOLD = 0.7;

function fieldClass(key: string, extracted: DocumentExtraction | null): string {
  if (!extracted) return "input mt-1";
  const conf = extracted.confidence[key];
  if (conf !== undefined && conf < CONFIDENCE_THRESHOLD) {
    return "input mt-1 border-status-negative-text bg-status-negative-text/5";
  }
  return "input mt-1";
}

function Field({
  label,
  name,
  defaultValue,
  extracted,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  extracted: DocumentExtraction | null;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</label>
      {/* Nome do campo é "<secao>_<subcampo>" (ex.: "patient_full_name"); a
          confiança devolvida pelo Gemini vem chaveada como "<secao>.<subcampo>"
          (ex.: "patient.full_name") — troca só o primeiro "_" por "." pra casar
          os dois, sem regex: String.replace(string, ...) já para na 1ª ocorrência. */}
      <input name={name} type={type} defaultValue={defaultValue} className={fieldClass(name.replace("_", "."), extracted)} />
    </div>
  );
}

function FileViewButton({ fileId }: { fileId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await getDraftFileUrl(fileId);
          if (result.success) window.open(result.url, "_blank", "noopener,noreferrer");
        })
      }
      className="rounded-md border border-paper-line-strong px-2 py-1 text-xs text-ink hover:border-chart disabled:opacity-50"
    >
      {isPending ? "Abrindo…" : "Ver arquivo"}
    </button>
  );
}

export function DraftReviewForm({
  draftId,
  status,
  extracted,
  warnings,
  error,
  files,
  insurers,
  hasPatient,
  duplicateCandidates,
}: {
  draftId: string;
  status: string;
  extracted: DocumentExtraction | null;
  warnings: string[];
  error: string | null;
  files: FileRow[];
  insurers: Insurer[];
  hasPatient: boolean;
  duplicateCandidates: DuplicateCandidate[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [linkPatientId, setLinkPatientId] = useState("");
  const [isPending, startTransition] = useTransition();

  const p = extracted?.patient;
  const g = extracted?.guardian;
  const a = extracted?.address;
  const ins = extracted?.insurance;
  const auth = extracted?.authorization;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex w-full flex-col gap-3 lg:w-80 lg:shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Documentos ({files.length})</h2>
        {files.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-paper-line-strong bg-paper/60 px-3 py-2 text-xs">
            <span className="truncate">{f.original_name ?? f.mime_type}</span>
            <FileViewButton fileId={f.id} />
          </div>
        ))}
        {status === "failed" && (
          <p className="text-xs text-status-negative-text">
            A extração falhou{error ? `: ${error}` : "."} Você pode preencher manualmente abaixo ou reprocessar.
          </p>
        )}
      </div>

      <form
        className="flex flex-1 flex-col gap-6"
        action={(formData) => {
          setFormError(null);
          if (linkPatientId) formData.set("link_patient_id", linkPatientId);
          startTransition(async () => {
            const result = await validateRegistrationDraft(draftId, formData);
            if (!result.success) {
              setFormError(result.error);
              return;
            }
            router.push(`/recepcao/pacientes/${result.patientId}`);
          });
        }}
      >
        {warnings.length > 0 && (
          <div className="rounded-md border border-status-pending-text bg-status-pending-soft px-4 py-3 text-xs text-status-pending-text">
            {warnings.map((w, i) => (
              <p key={i}>⚠️ {w}</p>
            ))}
          </div>
        )}

        {!hasPatient && duplicateCandidates.length > 0 && (
          <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
            <p className="text-xs font-semibold text-ink-soft">Possível duplicata — vincular a paciente existente?</p>
            <div className="mt-2 flex flex-col gap-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="_dup" checked={linkPatientId === ""} onChange={() => setLinkPatientId("")} />
                Criar novo paciente
              </label>
              {duplicateCandidates.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs">
                  <input type="radio" name="_dup" checked={linkPatientId === c.id} onChange={() => setLinkPatientId(c.id)} />
                  Vincular a {c.full_name} (nasc. {c.birth_date})
                </label>
              ))}
            </div>
          </div>
        )}

        <fieldset className="rounded-md border border-paper-line-strong p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="apply_patient" defaultChecked={Boolean(p?.full_name || p?.birth_date)} /> Paciente
            </label>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nome" name="patient_full_name" defaultValue={p?.full_name ?? ""} extracted={extracted} />
            <Field label="Nascimento" name="patient_birth_date" type="date" defaultValue={p?.birth_date ?? ""} extracted={extracted} />
            <Field label="CPF" name="patient_cpf" defaultValue={p?.cpf ?? ""} extracted={extracted} />
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Sexo</label>
              <select name="patient_sexo" defaultValue={p?.sexo ?? ""} className="input mt-1">
                <option value="">—</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </div>
            <Field label="Naturalidade" name="patient_naturalidade" defaultValue={p?.naturalidade ?? ""} extracted={extracted} />
            <Field label="CID" name="patient_cid" defaultValue={p?.cid ?? ""} extracted={extracted} />
            <Field label="Queixa (do laudo)" name="patient_complaint" defaultValue={p?.complaint_hint ?? ""} extracted={extracted} />
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-paper-line-strong p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="apply_guardian" defaultChecked={Boolean(g?.full_name || g?.phone)} /> Responsável
            </label>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nome" name="guardian_full_name" defaultValue={g?.full_name ?? ""} extracted={extracted} />
            <Field label="Telefone" name="guardian_phone" defaultValue={g?.phone ?? ""} extracted={extracted} />
            <Field label="CPF" name="guardian_cpf" defaultValue={g?.cpf ?? ""} extracted={extracted} />
            <Field label="RG" name="guardian_rg" defaultValue={g?.rg ?? ""} extracted={extracted} />
            <Field label="E-mail" name="guardian_email" defaultValue={g?.email ?? ""} extracted={extracted} />
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Parentesco</label>
              <select name="guardian_relationship" defaultValue={g?.relationship ?? ""} className="input mt-1">
                <option value="">—</option>
                <option value="mae">Mãe</option>
                <option value="pai">Pai</option>
                <option value="avo">Avô/Avó</option>
                <option value="tutor">Tutor(a)</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-paper-line-strong p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="apply_address" defaultChecked={Boolean(a?.cep || a?.logradouro)} /> Endereço
            </label>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="CEP" name="address_cep" defaultValue={a?.cep ?? ""} extracted={extracted} />
            <Field label="Logradouro" name="address_logradouro" defaultValue={a?.logradouro ?? ""} extracted={extracted} />
            <Field label="Número" name="address_numero" defaultValue={a?.numero ?? ""} extracted={extracted} />
            <Field label="Complemento" name="address_complemento" defaultValue={a?.complemento ?? ""} extracted={extracted} />
            <Field label="Bairro" name="address_bairro" defaultValue={a?.bairro ?? ""} extracted={extracted} />
            <Field label="Cidade" name="address_cidade" defaultValue={a?.cidade ?? ""} extracted={extracted} />
            <Field label="UF" name="address_uf" defaultValue={a?.uf ?? ""} extracted={extracted} />
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-paper-line-strong p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="apply_insurance" defaultChecked={Boolean(ins?.insurer_name)} /> Convênio
            </label>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Convênio</label>
              <select name="insurer_id" defaultValue={ins?.insurer_id ?? ""} className="input mt-1">
                <option value="">
                  {ins?.insurer_name ? `— não identificado ("${ins.insurer_name}") —` : "Selecione"}
                </option>
                {insurers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Nº carteirinha" name="insurance_card_number" defaultValue={ins?.card_number ?? ""} extracted={extracted} />
            <Field label="Plano" name="insurance_plan_name" defaultValue={ins?.plan_name ?? ""} extracted={extracted} />
            <Field label="Validade carteirinha" name="insurance_card_valid_until" type="date" defaultValue={ins?.card_valid_until ?? ""} extracted={extracted} />
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-paper-line-strong p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="apply_authorization" defaultChecked={Boolean(auth?.guide_number || auth?.procedure_code)} /> Guia de autorização
            </label>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nº guia" name="authorization_guide_number" defaultValue={auth?.guide_number ?? ""} extracted={extracted} />
            <Field label="Procedimento" name="authorization_procedure_code" defaultValue={auth?.procedure_code ?? ""} extracted={extracted} />
            <Field
              label="Sessões autorizadas"
              name="authorization_sessions_authorized"
              type="number"
              defaultValue={auth?.sessions_authorized != null ? String(auth.sessions_authorized) : ""}
              extracted={extracted}
            />
            <Field label="Válida de" name="authorization_valid_from" type="date" defaultValue={auth?.valid_from ?? ""} extracted={extracted} />
            <Field label="Válida até" name="authorization_valid_to" type="date" defaultValue={auth?.valid_to ?? ""} extracted={extracted} />
            <Field label="Senha" name="authorization_password" defaultValue={auth?.authorization_password ?? ""} extracted={extracted} />
            <Field label="Senha válida até" name="authorization_password_valid_until" type="date" defaultValue={auth?.password_valid_until ?? ""} extracted={extracted} />
          </div>
        </fieldset>

        {files.length > 0 && (
          <fieldset className="rounded-md border border-paper-line-strong p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Categoria de cada documento</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {files.map((f) => (
                <div key={f.id}>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">{f.original_name ?? f.mime_type}</label>
                  <select name={`file_category_${f.id}`} defaultValue={f.detected_type ?? "outro"} className="input mt-1">
                    {DOCUMENT_CATEGORIES.filter((c) => c.value !== "familia_envio").map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {formError && <p className="text-sm text-status-negative-text">{formError}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? "Salvando…" : "Confirmar cadastro"}
          </button>
          <button
            type="button"
            disabled={isPending}
            className="btn btn-secondary"
            onClick={() =>
              startTransition(async () => {
                const result = await reprocessRegistrationDraft(draftId);
                if (!result.success) setFormError(result.error);
                else router.refresh();
              })
            }
          >
            Reprocessar com IA
          </button>
          <button type="button" disabled={isPending} className="btn btn-ghost text-status-negative-text" onClick={() => setShowReject((v) => !v)}>
            Rejeitar
          </button>
        </div>

        {showReject && (
          <div className="flex flex-col gap-2 rounded-md border border-status-negative-text bg-status-negative-text/5 p-4">
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Motivo da rejeição</label>
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input" />
            <button
              type="button"
              disabled={isPending}
              className="btn btn-secondary self-start"
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectRegistrationDraft(draftId, rejectReason);
                  if (!result.success) setFormError(result.error);
                  else router.push("/recepcao/pre-cadastros");
                })
              }
            >
              Confirmar rejeição
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
