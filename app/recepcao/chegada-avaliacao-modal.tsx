"use client";

import { useRef, useState, useTransition } from "react";
import { UserCheck, X, UploadCloud, Check, AlertCircle, FileText } from "lucide-react";
import { GuiaSection } from "./guia-quick-action-modal";
import { uploadDocument } from "./pacientes/[id]/documents-actions";
import { checkIn } from "./agenda/session-actions";
import { printCoupon } from "@/lib/print-coupon";
import type { CouponModel } from "@/lib/checkin-coupon";

/**
 * Chegada de paciente de 1ª avaliação / acolhimento / anamnese.
 *
 * Esse paciente costuma chegar sem guia nem laudo (é a primeira vez dele na
 * clínica), mas às vezes já traz os dois em mãos — daí este modal reunir,
 * num único passo antes do check-in em si: cadastro/vínculo opcional de
 * guia (reaproveita GuiaSection, mesma lógica de guia-quick-action-modal.tsx)
 * e anexo opcional do laudo como `documents.category='laudo'` (mesma action
 * de upload usada na ficha do paciente, documents-actions.ts). Nada aqui é
 * obrigatório — "Confirmar chegada" segue liberado mesmo com as duas seções
 * vazias, porque a recepção não deve travar a entrada do paciente por falta
 * de documentação (mesma decisão de não bloquear já tomada em checkIn()).
 */
export function ChegadaAvaliacaoModal({
  isOpen,
  onClose,
  appointmentId,
  patientId,
  patientName,
  onConfirmed,
}: {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  patientId: string;
  patientName: string;
  onConfirmed: (result: { warning?: string; coupon?: CouponModel | null }) => void;
}) {
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [isCheckingIn, startCheckinTransition] = useTransition();

  const [laudoError, setLaudoError] = useState<string | null>(null);
  const [laudoSuccess, setLaudoSuccess] = useState(false);
  const [isUploadingLaudo, startLaudoTransition] = useTransition();
  const laudoFormRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  function handleLaudoUpload(formData: FormData) {
    setLaudoError(null);
    formData.set("category", "laudo");
    startLaudoTransition(async () => {
      const result = await uploadDocument(patientId, formData);
      if (!result.success) {
        setLaudoError(result.error);
        return;
      }
      setLaudoSuccess(true);
      laudoFormRef.current?.reset();
    });
  }

  function handleConfirmarChegada() {
    setCheckinError(null);
    startCheckinTransition(async () => {
      const result = await checkIn(appointmentId);
      if (!result.success) {
        setCheckinError(result.error);
        return;
      }
      if (result.coupon) printCoupon(result.coupon);
      onConfirmed(result);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-paper-line bg-paper shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper-line p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart/10 text-chart">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Chegada · Primeira avaliação / acolhimento / anamnese</h3>
              <p className="text-xs text-ink-soft">Paciente: <strong className="text-ink">{patientName}</strong></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-line-strong hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          <p className="text-xs text-ink-soft">
            Guia autorizada e laudo são opcionais aqui — só cadastre se o responsável já trouxe. Isso não impede o check-in.
          </p>

          <div>
            <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
              Guia autorizada (opcional)
            </h4>
            <GuiaSection patientId={patientId} appointmentId={appointmentId} />
          </div>

          <div>
            <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-chart" />
              Laudo (opcional)
            </h4>

            {laudoError && (
              <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{laudoError}</span>
              </div>
            )}
            {laudoSuccess && (
              <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>Laudo anexado com sucesso!</span>
              </div>
            )}

            <form
              ref={laudoFormRef}
              action={handleLaudoUpload}
              className="flex flex-col gap-2.5 rounded-lg border border-dashed border-paper-line-strong bg-paper-line-strong/20 p-3.5"
            >
              <input
                type="file"
                name="file"
                required
                accept="image/*,application/pdf"
                capture="environment"
                className="input text-xs w-full"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUploadingLaudo}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  {isUploadingLaudo ? "Enviando…" : "Anexar laudo"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-paper-line p-4 bg-paper-line-strong/10">
          {checkinError && <p className="text-xs text-status-negative-text">{checkinError}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary text-xs" disabled={isCheckingIn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarChegada}
              disabled={isCheckingIn}
              className="btn btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {isCheckingIn ? "Registrando…" : "Confirmar chegada e imprimir cupom"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
