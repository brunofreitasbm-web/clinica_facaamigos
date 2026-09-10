"use client";

import { useRef, useState, useTransition } from "react";
import { createIntervention, renameInterventionLabel, toggleInterventionActive } from "./actions";
import { PageContainer } from "@/components/page-container";

export type InterventionRow = {
  id: string;
  value: string;
  label: string;
  discipline: string | null;
  active: boolean;
};

function InterventionRowView({ intervention }: { intervention: InterventionRow }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(intervention.label);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <tr>
      <td>
        {editing ? (
          <input
            className="input"
            style={{ minWidth: 180 }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        ) : (
          <span className={intervention.active ? "" : "text-ink-faint line-through"}>{intervention.label}</span>
        )}
      </td>
      <td className="text-ink-faint">
        <code className="text-xs">{intervention.value}</code>
      </td>
      <td>{intervention.discipline ?? <span className="text-ink-faint">todas</span>}</td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("label", label);
                    const result = await renameInterventionLabel(intervention.id, fd);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setEditing(false);
                  });
                }}
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
                Renomear
              </button>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void toggleInterventionActive(intervention.id, !intervention.active);
                  })
                }
              >
                {intervention.active ? "Desativar" : "Reativar"}
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function IntervencoesManager({ interventions }: { interventions: InterventionRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-1">
      <PageContainer>
        <h1 className="mb-1">Intervenções do terapeuta</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Lista de técnicas/intervenções que aparece no formulário de evolução, para o terapeuta marcar o que foi
          aplicado durante o atendimento e a resposta do paciente — essa linha do tempo alimenta a síntese da
          evolução. Uma intervenção já usada em algum registro de sessão não pode ser apagada — desative-a em vez
          disso; o nome (rótulo) pode ser corrigido a qualquer momento.
        </p>

        <table className="table mb-6">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Chave</th>
              <th>Disciplina</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {interventions.map((i) => (
              <InterventionRowView key={i.id} intervention={i} />
            ))}
            {interventions.length === 0 && (
              <tr>
                <td colSpan={4} className="text-ink-faint">
                  Nenhuma intervenção cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form
          ref={formRef}
          className="grid max-w-[520px] grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:grid-cols-2"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createIntervention(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
            });
          }}
        >
          <input name="label" required placeholder="Nome da intervenção" className="input sm:col-span-2" />
          <input
            name="discipline"
            placeholder="Disciplina (opcional — vazio = todas)"
            className="input sm:col-span-2"
          />
          <button type="submit" disabled={isPending} className="btn btn-primary sm:col-span-2 w-fit">
            {isPending ? "Adicionando…" : "+ Adicionar intervenção"}
          </button>
          {error && <p className="text-xs text-status-negative-text sm:col-span-2">{error}</p>}
        </form>
      </PageContainer>
    </div>
  );
}
