"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserX, Undo2, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { NON_PATIENT_REASONS } from "@/lib/non-patient-contacts-pure";
import { markContactNotPatient, unmarkContactNotPatient } from "@/app/recepcao/non-patient-actions";

/**
 * "Não é paciente" (Autorizações e painel do lead no Chat): tira o contato de
 * Autorizações/Pendências/leads e impede o robô de recriar o card para o mesmo
 * número. O chat segue aberto até alguém encerrar. Com `markedReason` o botão
 * vira "Desfazer".
 */
export function NotPatientButton({
  phone,
  draftId,
  markedReason,
  compact = false,
  onChanged,
}: {
  phone?: string | null;
  draftId?: string | null;
  /** Motivo já gravado: mostra a marcação e o "Desfazer" em vez do botão. */
  markedReason?: string | null;
  compact?: boolean;
  /** Avisado após marcar (motivo) ou desfazer (null), para quem guarda o estado no cliente (painel do Chat). */
  onChanged?: (reason: string | null) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!phone && !draftId) return null;

  if (markedReason) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
        <span className="inline-flex items-center gap-1 rounded-full bg-paper-line/60 px-2 py-0.5 font-medium text-ink">
          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
          Não é paciente · {markedReason}
        </span>
        {phone && (
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1 text-[13px] text-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
            onClick={() =>
              startTransition(async () => {
                const res = await unmarkContactNotPatient(phone);
                if (!res.success) {
                  toast(res.error, "error");
                  return;
                }
                toast("Marcação desfeita. O contato volta a ser tratado como lead.", "success");
                onChanged?.(null);
                router.refresh();
              })
            }
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Desfazer
          </button>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink" : "btn btn-secondary inline-flex items-center gap-1.5"}
        onClick={() => setOpen(true)}
        title="Dúvida, publicidade, fornecedor: tira o contato de Autorizações sem encerrar o chat"
      >
        <UserX className="h-3.5 w-3.5" aria-hidden="true" />
        Não é paciente
      </button>
      {open && (
        <NotPatientDialog
          pending={pending}
          onClose={() => setOpen(false)}
          onConfirm={(reasonValue, detail, setError) =>
            startTransition(async () => {
              const res = await markContactNotPatient({ phone, draftId, reasonValue, detail });
              if (!res.success) {
                setError(res.error);
                return;
              }
              toast("Contato marcado como \"não é paciente\". O chat segue aberto.", "success");
              setOpen(false);
              onChanged?.(res.reason ?? reasonValue);
              router.refresh();
            })
          }
        />
      )}
    </>
  );
}

function NotPatientDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (reasonValue: string, detail: string, setError: (msg: string) => void) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needsDetail = reason === "outro";
  const canSubmit = Boolean(reason) && (!needsDetail || detail.trim().length > 0) && !pending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Não é paciente"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-[min(480px,96vw)] flex-col rounded-xl border border-paper-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
          <h3 className="m-0 text-base font-semibold text-ink">Não é paciente</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-paper-line-strong hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="flex flex-col gap-3 px-5 py-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            setError(null);
            onConfirm(reason, detail, setError);
          }}
        >
          <p className="m-0 text-ink-soft">
            O contato sai de Autorizações, Pendências e da lista de leads, e o robô não abre card novo para este número. O chat continua
            aberto até alguém encerrar. Nenhuma mensagem é enviada à pessoa.
          </p>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Motivo</legend>
            {NON_PATIENT_REASONS.map((option) => (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-2 text-ink">
                <input
                  type="radio"
                  name="non-patient-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Detalhe {needsDetail ? "(obrigatório)" : "(opcional)"}
            </span>
            <input
              type="text"
              maxLength={300}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="input"
              placeholder="Ex.: empresa de marketing oferecendo serviço"
            />
          </label>
          {error && <p className="m-0 text-[13px] text-status-negative-text">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {pending ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
