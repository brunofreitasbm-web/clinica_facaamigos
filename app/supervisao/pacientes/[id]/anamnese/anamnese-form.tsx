"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAnamnese } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";
const sectionClass = "rounded-md border border-paper-line-strong bg-paper/60 p-4";

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
    <form action={handleSubmit} className="flex max-w-3xl flex-col gap-6">
      {/* Seção: Queixa e História Atual */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Queixa e História Atual</legend>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Queixa principal</label>
            <p className="mt-0.5 text-xs text-ink-faint">Por que a família procurou o serviço agora?</p>
            <textarea name="chief_complaint" rows={3} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">História da queixa</label>
            <p className="mt-0.5 text-xs text-ink-faint">Desde quando começou? Como tem evoluído?</p>
            <textarea name="complaint_history" rows={2} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Seção: Histórico do Desenvolvimento */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Histórico do Desenvolvimento</legend>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Gestação e parto</label>
            <p className="mt-0.5 text-xs text-ink-faint">Gravidez normal? Intercorrências? Como foi o parto?</p>
            <textarea name="gestational_history" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Marcos do desenvolvimento motor</label>
            <p className="mt-0.5 text-xs text-ink-faint">Quando começou a segurar cabeça, rolar, sentar, andar?</p>
            <textarea name="motor_development" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Desenvolvimento da linguagem</label>
            <p className="mt-0.5 text-xs text-ink-faint">Primeiras palavras, evolução da fala/linguagem</p>
            <textarea name="language_development" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Desenvolvimento cognitivo e adaptativo</label>
            <p className="mt-0.5 text-xs text-ink-faint">Autonomia, brincadeiras, interação social</p>
            <textarea name="cognitive_development" rows={2} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Seção: Histórico Médico e Saúde */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Histórico Médico e Saúde</legend>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Alergias e intolerâncias</label>
            <input name="allergies" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Medicações em uso</label>
            <textarea name="medications" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Cirurgias e hospitalizações</label>
            <textarea name="medical_history" rows={2} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Seção: Histórico de Tratamentos Anteriores */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Histórico de Tratamentos Anteriores</legend>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Terapias e acompanhamentos prévios</label>
            <p className="mt-0.5 text-xs text-ink-faint">Fonoaudiologia, psicologia, educação especial, etc. Quando? Por quanto tempo?</p>
            <textarea name="previous_treatments" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Resultados e observações de tratamentos anteriores</label>
            <textarea name="treatment_outcomes" rows={2} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {/* Seção: Contexto Familiar e Escolar */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Contexto Familiar e Escolar</legend>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Composição familiar</label>
            <p className="mt-0.5 text-xs text-ink-faint">Pais, irmãos, quem mais vive com a criança</p>
            <textarea name="family_composition" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Rotina diária da criança</label>
            <textarea name="routine" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Situação escolar</label>
            <input name="school" className={inputClass} placeholder="Escola, série, professor de AEE" />
          </div>
        </div>
      </fieldset>

      {/* Seção: Prioridades da Família */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">Prioridades da Família</legend>
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            O que a família considera como prioridade para tratar
          </label>
          <p className="text-xs text-ink-faint">
            Este texto fica disponível na hora de montar o PTS — garante que uma prioridade relatada pela família não se perca até o PDI.
          </p>
          <textarea name="family_priorities" rows={2} className={inputClass} />
        </div>
      </fieldset>

      {/* Seção: O que foi apresentado à família */}
      <fieldset className={sectionClass}>
        <legend className="text-xs font-medium uppercase tracking-wide text-ink-soft">O que foi apresentado à família</legend>
        <div className="mt-4 flex flex-col gap-2 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_pillars" /> Pilares do método e estrutura do serviço
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_absence_policy" /> Prazos e política de faltas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="presented_protocols" /> Protocolos utilizados (VB-MAPP, ABLLS-R, AFLS etc.)
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Salvar 1ª avaliação (anamnese ampliada)"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
