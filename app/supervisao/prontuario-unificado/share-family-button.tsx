"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";
import { generateFamilyShare } from "./actions";

type DocumentOption = { id: string; categoryLabel: string; uploadedAt: string };
type GoalOption = { id: string; description: string; statusLabel: string };
type MeetingOption = { id: string; kindLabel: string; heldAt: string };

export function ShareFamilyButton({
  patientId,
  documents,
  goals,
  meetings,
}: {
  patientId: string;
  documents: DocumentOption[];
  goals: GoalOption[];
  meetings: MeetingOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whatsappWarning?: string } | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());

  const hasAnyOption = documents.length > 0 || goals.length > 0 || meetings.length > 0;
  const selectedCount = selectedDocs.size + selectedGoals.size + selectedMeetings.size;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function closeAndReset() {
    setIsOpen(false);
    setError(null);
    setResult(null);
    setSelectedDocs(new Set());
    setSelectedGoals(new Set());
    setSelectedMeetings(new Set());
  }

  async function handleGenerate() {
    if (selectedCount === 0) {
      setError("Selecione ao menos um item para compartilhar.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const res = await generateFamilyShare(patientId, {
      documentIds: Array.from(selectedDocs),
      goalIds: Array.from(selectedGoals),
      meetingIds: Array.from(selectedMeetings),
    });
    setIsSubmitting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setResult({ whatsappWarning: res.whatsappWarning });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setIsOpen(true)}
        disabled={!hasAnyOption}
        title={!hasAnyOption ? "Não há itens elegíveis para compartilhar com a família" : undefined}
      >
        <Share2 size={16} /> Compartilhar com a família
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={closeAndReset}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="m-0">Compartilhar com a família</h4>
              <button type="button" onClick={closeAndReset} aria-label="Fechar" className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {result ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-emerald-700 font-medium">
                  PDF gerado e disponibilizado no portal da família.
                </p>
                {result.whatsappWarning && <p className="text-xs text-amber-700">{result.whatsappWarning}</p>}
                <button type="button" className="btn btn-primary text-xs self-end" onClick={closeAndReset}>
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-faint mb-4">
                  Selecione o que deseja incluir no PDF. Evoluções clínicas e avaliações de protocolo não estão
                  disponíveis para este compartilhamento.
                </p>

                <div className="flex flex-col gap-5">
                  {documents.length > 0 && (
                    <div>
                      <h6 className="mb-2">Documentos</h6>
                      <div className="flex flex-col gap-1">
                        {documents.map((d) => (
                          <label key={d.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(d.id)}
                              onChange={() => toggle(selectedDocs, setSelectedDocs, d.id)}
                            />
                            {d.categoryLabel} <span className="text-ink-faint">· {d.uploadedAt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {goals.length > 0 && (
                    <div>
                      <h6 className="mb-2">Metas do plano terapêutico</h6>
                      <div className="flex flex-col gap-1">
                        {goals.map((g) => (
                          <label key={g.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedGoals.has(g.id)}
                              onChange={() => toggle(selectedGoals, setSelectedGoals, g.id)}
                            />
                            {g.description} <span className="text-ink-faint">· {g.statusLabel}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {meetings.length > 0 && (
                    <div>
                      <h6 className="mb-2">Reuniões</h6>
                      <div className="flex flex-col gap-1">
                        {meetings.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedMeetings.has(m.id)}
                              onChange={() => toggle(selectedMeetings, setSelectedMeetings, m.id)}
                            />
                            {m.kindLabel} <span className="text-ink-faint">· {m.heldAt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && <p className="text-xs text-red-600 mt-4">{error}</p>}

                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary text-xs" onClick={closeAndReset}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary text-xs disabled:opacity-50"
                    onClick={handleGenerate}
                    disabled={isSubmitting || selectedCount === 0}
                  >
                    {isSubmitting ? "Gerando..." : "Gerar e compartilhar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
