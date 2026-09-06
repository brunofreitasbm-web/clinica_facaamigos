"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "../actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

const DEVOLUTIVA_STEPS = [
  { key: "agenda_preparacao", label: "Preparação (revisar prontuário, gráficos, avaliações)" },
  { key: "agenda_abertura", label: "Abertura acolhedora" },
  { key: "agenda_dados", label: "Compartilhamento de dados (evolução, frequência, desafios)" },
  { key: "agenda_escuta", label: "Escuta ativa (validar emoções, anotar dúvidas)" },
  { key: "agenda_estrategias", label: "Estratégias futuras / próximos passos" },
  { key: "agenda_alinhamento", label: "Alinhamento (confirmar entendimento e acordos)" },
  { key: "agenda_encerramento", label: "Encerramento (agradecimento, reforço de parceria)" },
];

export function MeetingForm({
  patientId,
  initialKind,
  planOptions,
}: {
  patientId: string;
  initialKind: string;
  planOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState(initialKind || "interdisciplinar");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMeeting(patientId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/recepcao/pacientes/${patientId}#checklist-entrada`);
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Tipo de reunião</label>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
          <option value="interdisciplinar">Reunião técnica multidisciplinar</option>
          <option value="devolutiva">Devolutiva à família</option>
          <option value="revisao_pdi">Revisão do PDI</option>
          <option value="visita_escolar">Visita escolar</option>
        </select>
      </div>

      <div className="flex gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Data</label>
          <input type="date" name="held_at_date" required className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Hora</label>
          <input type="time" name="held_at_time" className={inputClass} />
        </div>
      </div>

      {kind === "devolutiva" && planOptions.length > 0 && (
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Plano entregue nesta devolutiva (opcional)</label>
          <select name="treatment_plan_id" className={inputClass}>
            <option value="">—</option>
            {planOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind === "devolutiva" && (
        <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">Etapas da devolutiva</div>
          <div className="mt-2 flex flex-col gap-2 text-sm text-ink">
            {DEVOLUTIVA_STEPS.map((s) => (
              <label key={s.key} className="flex items-center gap-2">
                <input type="checkbox" name={s.key} /> {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="family_present" /> Família presente
      </label>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Ata / resumo</label>
        <textarea name="minutes" rows={4} required className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Decisões (opcional)</label>
        <textarea name="decisions" rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Registrar reunião"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
