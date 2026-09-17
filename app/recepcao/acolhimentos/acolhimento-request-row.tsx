"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AcolhimentoRequestRow as AcolhimentoRequestRowType } from "@/lib/acolhimento-requests";
import { filterEvaluationRooms } from "@/lib/evaluation-agenda";
import { scheduleAcolhimento, confirmAcolhimentoArrival, deliverContract, informFamily } from "./actions";

type Person = { id: string; full_name: string };
type Room = { id: string; name: string; is_evaluation_room?: boolean };
type AppointmentType = { id: string; name: string };

/**
 * Ações por linha da tela de Acolhimentos da Recepção — o botão/formulário
 * exibido depende do status atual do pedido (ver AcolhimentoStatus em
 * lib/acolhimento-requests.ts):
 *  - aguardando_agendamento → agendar 1ª avaliação (scheduleAcolhimento)
 *  - agendado / aguardando_pagamento → confirmar chegada (confirmAcolhimentoArrival)
 *  - realizado → entregar contrato (deliverContract)
 *  - contrato_pendente → informar família (informFamily)
 *  - grade_pendente → aguardando Supervisão definir a grade (sem ação aqui)
 */
export function AcolhimentoRequestRow({
  request,
  therapists,
  supervisors,
  rooms,
  appointmentTypes,
}: {
  request: AcolhimentoRequestRowType;
  therapists: Person[];
  supervisors: Person[];
  rooms: Room[];
  appointmentTypes: AppointmentType[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);

  const evaluationRooms = filterEvaluationRooms(rooms);

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        setError(res.error ?? "Não foi possível concluir a ação.");
        return;
      }
      setScheduleOpen(false);
      setArrivalOpen(false);
      setFamilyOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      {error && <p className="text-xs text-status-negative-text">{error}</p>}

      {request.status === "aguardando_agendamento" && !scheduleOpen && (
        <button type="button" className="btn btn-primary text-xs" onClick={() => setScheduleOpen(true)}>
          Agendar 1ª avaliação
        </button>
      )}

      {request.status === "aguardando_agendamento" && scheduleOpen && (
        <form
          className="flex w-80 flex-col gap-2 rounded-md border border-paper-line-strong bg-paper p-3 text-left"
          action={(formData) => runAction(() => scheduleAcolhimento(request.id, formData))}
        >
          <select name="therapist_id" required className="input text-xs">
            <option value="">Avaliador</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <select name="supervisor_id" className="input text-xs">
            <option value="">Supervisor responsável (opcional)</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <select name="room_id" required className="input text-xs">
            <option value="">Sala</option>
            {(evaluationRooms.length > 0 ? evaluationRooms : rooms).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select name="appointment_type_id" required className="input text-xs">
            <option value="">Tipo de atendimento</option>
            {appointmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input type="date" name="date" required className="input text-xs" />
          <input type="time" name="time" required className="input text-xs" />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
              {isPending ? "Agendando…" : "Confirmar"}
            </button>
          </div>
        </form>
      )}

      {(request.status === "agendado" || request.status === "aguardando_pagamento") && !arrivalOpen && (
        <button type="button" className="btn btn-primary text-xs" onClick={() => setArrivalOpen(true)}>
          Confirmar chegada
        </button>
      )}

      {(request.status === "agendado" || request.status === "aguardando_pagamento") && arrivalOpen && (
        <form
          className="flex w-64 flex-col gap-2 rounded-md border border-paper-line-strong bg-paper p-3 text-left"
          action={(formData) => runAction(() => confirmAcolhimentoArrival(request.id, formData))}
        >
          {request.funding === "particular" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Valor cobrado (R$)</label>
              <input name="amount" type="number" step="0.01" min="0.01" placeholder="Preenchido pela tabela de preços, se houver" className="input mt-1 text-xs" />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setArrivalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
              {isPending ? "Confirmando…" : "Confirmar"}
            </button>
          </div>
        </form>
      )}

      {request.status === "realizado" && (
        <button
          type="button"
          disabled={isPending}
          className="btn btn-primary text-xs"
          onClick={() => runAction(() => deliverContract(request.id))}
        >
          {isPending ? "Registrando…" : "Marcar contrato entregue"}
        </button>
      )}

      {request.status === "contrato_pendente" && !familyOpen && (
        <button type="button" className="btn btn-primary text-xs" onClick={() => setFamilyOpen(true)}>
          Informar família
        </button>
      )}

      {request.status === "contrato_pendente" && familyOpen && (
        <form
          className="flex w-64 flex-col gap-2 rounded-md border border-paper-line-strong bg-paper p-3 text-left"
          action={(formData) => runAction(() => informFamily(request.id, formData))}
        >
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="whatsappGroup" />
            Incluir no grupo de WhatsApp
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setFamilyOpen(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
              {isPending ? "Concluindo…" : "Concluir"}
            </button>
          </div>
        </form>
      )}

      {request.status === "grade_pendente" && (
        <span className="text-xs text-ink-faint">Aguardando Supervisão definir a grade fixa</span>
      )}
    </div>
  );
}
