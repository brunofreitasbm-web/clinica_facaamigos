"use client";

import { useState, useTransition } from "react";
import { setInstrumentEnabled } from "./actions";
import { DISCIPLINES } from "@/app/supervisao/planos/novo/disciplines";

export type InstrumentRow = {
  key: string;
  shortLabel: string;
  label: string;
  description: string;
  disciplineLabel: string;
  enabled: boolean;
};

function InstrumentRowView({ instrument }: { instrument: InstrumentRow }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <tr>
      <td>
        <span className={`font-medium ${instrument.enabled ? "text-ink" : "text-ink-faint line-through"}`}>
          {instrument.shortLabel}
        </span>
        <p className="m-0 text-xs text-ink-faint">{instrument.description}</p>
      </td>
      <td className="text-ink-faint text-sm">{instrument.disciplineLabel}</td>
      <td>
        {instrument.enabled ? (
          <span className="inline-flex items-center rounded-full bg-status-positive-bg px-2.5 py-0.5 text-xs font-medium text-status-positive-text">
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-paper-line px-2.5 py-0.5 text-xs font-medium text-ink-faint">
            Inativo
          </span>
        )}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await setInstrumentEnabled(instrument.key, !instrument.enabled);
                if (!result.success) setError(result.error);
              })
            }
          >
            {instrument.enabled ? "Desativar" : "Reativar"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function InstrumentosManager({ instruments: initialInstruments }: { instruments: InstrumentRow[] }) {
  const [instruments, setInstruments] = useState<InstrumentRow[]>(initialInstruments);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulário individual
  const [shortLabel, setShortLabel] = useState("");
  const [label, setLabel] = useState("");
  const [discipline, setDiscipline] = useState<string>(DISCIPLINES[0]?.value ?? "aba");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortLabel.trim() || !label.trim()) {
      setFormError("Preencha o nome curto e o nome completo do instrumento.");
      return;
    }

    const newKey = `custom_${Date.now()}`;
    const selectedDiscipline = DISCIPLINES.find((d) => d.value === discipline)?.label ?? discipline;

    const newInstrument: InstrumentRow = {
      key: newKey,
      shortLabel: shortLabel.trim(),
      label: label.trim(),
      description: description.trim() || "Instrumento cadastrado individualmente.",
      disciplineLabel: selectedDiscipline,
      enabled: true,
    };

    setInstruments((prev) => [newInstrument, ...prev]);
    setShortLabel("");
    setLabel("");
    setDescription("");
    setFormError(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-ink">Instrumentos de Avaliação</h1>
            <p className="max-w-[760px] text-sm text-ink-soft">
              Gerencie e ative individualmente os instrumentos de avaliação da clínica. Ativar um instrumento disponibiliza atalhos e fichas de avaliação no prontuário do paciente; desativar oculta o atalho sem remover os históricos registrados.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            + Novo Instrumento
          </button>
        </div>

        <table className="table mb-6 w-full">
          <thead>
            <tr>
              <th>Instrumento</th>
              <th>Disciplina</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((instrument) => (
              <InstrumentRowView key={instrument.key} instrument={instrument} />
            ))}
          </tbody>
        </table>

        {/* Modal de Inserção Individual */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-paper-line bg-paper p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">Inserir Novo Instrumento</h2>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddInstrument} className="space-y-4">
                {formError && (
                  <div className="rounded-md bg-status-negative-bg p-3 text-xs text-status-negative-text">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Nome Curto / Sigla *
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Ex: CARS-2, PEP-3, M-CHAT"
                    value={shortLabel}
                    onChange={(e) => setShortLabel(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Nome Completo do Instrumento *
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Ex: Escala de Pontuação para Autismo na Infância"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Disciplina / Área
                  </label>
                  <select
                    className="input w-full"
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                  >
                    {DISCIPLINES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Descrição / Finalidade
                  </label>
                  <textarea
                    className="input w-full min-h-[80px]"
                    placeholder="Descreva a finalidade e público-alvo do instrumento..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormError(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Salvar Instrumento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

