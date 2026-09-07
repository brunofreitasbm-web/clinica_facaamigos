"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAnamnese } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function AnamneseForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveAnamnese(patientId, formData);
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
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Histórico e queixa principal
        </label>
        <textarea name="free_text" rows={4} className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Rotina da criança</label>
        <textarea name="routine" rows={2} className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Escola</label>
        <input name="school" className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Medicações em uso</label>
        <input name="medications" className={inputClass} />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Prioridades relatadas pela família
        </label>
        <p className="mt-0.5 text-xs text-ink-faint">
          O que a família apontou como mais urgente — este texto fica disponível na hora de montar o PTS (Módulo 3
          MAAIS, slide 22: &quot;a família relatou uma prioridade, mas ela não chegou ao PDI&quot;).
        </p>
        <textarea name="family_priorities" rows={2} className={inputClass} />
      </div>

      <div className="rounded-md border border-paper-line-strong bg-paper/60 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">O que foi apresentado à família</div>
        <div className="mt-2 flex flex-col gap-2 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_pillars" /> Pilares do MAAIS e estrutura do serviço
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_absence_policy" /> Prazos e política de faltas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_protocols" /> Protocolos utilizados (VB-MAPP, ABLLS-R, AFLS etc.)
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Salvar 1ª avaliação (anamnese)"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
