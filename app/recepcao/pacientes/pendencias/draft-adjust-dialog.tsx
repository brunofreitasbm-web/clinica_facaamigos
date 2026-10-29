"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import {
  loadDraftAdjustment,
  saveDraftAdjustment,
  splitSiblingFromDraft,
  type DraftAdjustData,
} from "./draft-adjust-actions";

/**
 * "Ajustar cadastro" do cartão de Autorizações / Fila de pendências: a recepção
 * e a supervisão corrigem dados do contato sem sair da tela e, quando duas
 * crianças chegaram juntas no mesmo contato, criam o irmão como cadastro
 * separado (cada criança precisa do próprio paciente e rascunho para aparecer
 * na Agenda de 1ª Avaliação).
 */

const LABEL = "text-xs font-medium uppercase tracking-wide text-ink-soft";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  wide,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className={LABEL} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="input mt-1"
      />
    </div>
  );
}

export function DraftAdjustButton({ draftId, label = "Ajustar cadastro" }: { draftId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary inline-flex items-center gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
      {open && <DraftAdjustDialog draftId={draftId} onClose={() => setOpen(false)} />}
    </>
  );
}

function DraftAdjustDialog({ draftId, onClose }: { draftId: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<DraftAdjustData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "irmao">("dados");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    loadDraftAdjustment(draftId).then((res) => {
      if (!alive) return;
      if (res.success) setData(res.data);
      else setLoadError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [draftId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (action: () => ReturnType<typeof saveDraftAdjustment>, successText: string) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        setError(res.error);
        return;
      }
      toast(res.note ?? successText, "success");
      router.refresh();
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar cadastro"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-[min(720px,96vw)] flex-col rounded-xl border border-paper-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
          <h3 className="m-0 text-base font-semibold text-ink">Ajustar cadastro</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-paper-line-strong hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-paper-line px-5 pt-2">
          {(
            [
              ["dados", "Corrigir dados"],
              ["irmao", "Separar irmão"],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setError(null);
              }}
              className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
                tab === key ? "border-b-2 border-[var(--color-accent)] text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5">
          {loadError && <p className="m-0 text-sm text-status-negative-text">{loadError}</p>}
          {!data && !loadError && <p className="m-0 text-sm text-ink-faint">Carregando…</p>}

          {data && tab === "dados" && (
            <form
              className="flex flex-col gap-4"
              action={(formData) => run(() => saveDraftAdjustment(draftId, formData), "Cadastro atualizado.")}
            >
              <input type="hidden" name="guardian_id" value={data.guardian.id ?? ""} />
              <input type="hidden" name="insurance_id" value={data.insurance.id ?? ""} />
              {!data.patient.id && (
                <p className="m-0 rounded-md bg-paper-line/40 px-3 py-2 text-xs text-ink-soft">
                  Esta criança ainda não tem prontuário: as correções valem para a fila e entram no cadastro quando
                  você usar “Conferir e cadastrar”.
                </p>
              )}
              <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
                <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Criança</legend>
                <Field label="Nome completo" name="patient_full_name" defaultValue={data.patient.fullName} required wide />
                <Field label="Nascimento" name="patient_birth_date" type="date" defaultValue={data.patient.birthDate} />
                <Field label="CPF" name="patient_cpf" defaultValue={data.patient.cpf} />
                <Field
                  label="CID / diagnóstico"
                  name="patient_cid"
                  defaultValue={data.patient.cid}
                  placeholder="Ex.: F84 / F90 ou 6A02"
                  wide
                />
                <Field label="Queixa principal" name="patient_complaint" defaultValue={data.patient.complaint} wide />
                <Field label="Nº da carteirinha" name="card_number" defaultValue={data.insurance.cardNumber} wide />
              </fieldset>
              <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
                <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                  Responsável
                </legend>
                <Field label="Nome" name="guardian_full_name" defaultValue={data.guardian.fullName} wide />
                <Field label="Telefone" name="guardian_phone" defaultValue={data.guardian.phone} />
                <Field label="CPF" name="guardian_cpf" defaultValue={data.guardian.cpf} />
                <Field label="E-mail" name="guardian_email" type="email" defaultValue={data.guardian.email} wide />
              </fieldset>
              {error && <p className="m-0 text-sm text-status-negative-text">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Salvando…" : "Salvar ajustes"}
                </button>
              </div>
            </form>
          )}

          {data && tab === "irmao" && (
            <form
              className="flex flex-col gap-4"
              action={(formData) => run(() => splitSiblingFromDraft(draftId, formData), "Irmão cadastrado.")}
            >
              <p className="m-0 rounded-md bg-paper-line/40 px-3 py-2 text-xs text-ink-soft">
                Use quando duas crianças vieram no mesmo contato e só uma aparece. O irmão é criado como paciente
                próprio, com o mesmo responsável e convênio, e entra na fila com a autorização já liberada para o
                contato de origem.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome completo do irmão" name="sibling_full_name" required wide />
                <Field label="Nascimento" name="sibling_birth_date" type="date" required />
                <Field label="CPF" name="sibling_cpf" />
                <Field label="CID / diagnóstico" name="sibling_cid" placeholder="Ex.: F84 / F90 ou 6A02" />
                <Field label="Nº da carteirinha" name="sibling_card_number" />
              </div>
              {error && <p className="m-0 text-sm text-status-negative-text">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary inline-flex items-center gap-1.5" disabled={pending}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {pending ? "Criando…" : "Criar irmão"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
