"use client";

import { useRef, useState, useTransition } from "react";
import { createSpecialty, renameSpecialtyLabel, toggleSpecialtyActive } from "./actions";
import { PageContainer } from "@/components/page-container";

export type SpecialtyRow = {
  id: string;
  value: string;
  label: string;
  active: boolean;
  internCount: number;
  pjCount: number;
};

function SpecialtyRowView({ specialty }: { specialty: SpecialtyRow }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(specialty.label);
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
          <span className={specialty.active ? "" : "text-ink-faint line-through"}>{specialty.label}</span>
        )}
      </td>
      <td className="text-ink-faint">
        <code className="text-xs">{specialty.value}</code>
      </td>
      <td className="tabular-nums">{specialty.internCount}</td>
      <td className="tabular-nums">{specialty.pjCount}</td>
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
                    const result = await renameSpecialtyLabel(specialty.id, fd);
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
                    void toggleSpecialtyActive(specialty.id, !specialty.active);
                  })
                }
              >
                {specialty.active ? "Desativar" : "Reativar"}
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function EspecialidadesManager({ specialties }: { specialties: SpecialtyRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-1">
      <PageContainer>
        <h1 className="mb-1">Especialidades</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Lista de especialidades profissionais (musicoterapia, fisioterapia, psicologia ABA, fonoaudiologia,
          entre outras) usada nos cadastros de terapeutas e equipe. Uma especialidade já vinculada a algum
          registro não pode ser apagada — desative-a em vez disso; o nome (rótulo) pode ser corrigido a
          qualquer momento. As quantidades de estagiários e de profissionais PJ são somente leitura: vêm do
          sistema de gestão de pessoas do Grupo IB (unidade Faça Amigos) e se atualizam sozinhas — inclusive
          criando aqui a especialidade que existir lá e ainda não estiver nesta lista. O nº de estagiários
          alimenta o Alerta de Necessidade de Estagiário em Inteligência (BI).
        </p>

        <table className="table mb-6">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Chave</th>
              <th>Estagiários</th>
              <th>Profissionais PJ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {specialties.map((s) => (
              <SpecialtyRowView key={s.id} specialty={s} />
            ))}
            {specialties.length === 0 && (
              <tr>
                <td colSpan={5} className="text-ink-faint">
                  Nenhuma especialidade cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form
          ref={formRef}
          className="grid max-w-[520px] grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createSpecialty(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
            });
          }}
        >
          <input name="label" required placeholder="Nome da especialidade" className="input" />
          <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
            {isPending ? "Adicionando…" : "+ Adicionar especialidade"}
          </button>
          {error && <p className="text-xs text-status-negative-text">{error}</p>}
        </form>
      </PageContainer>
    </div>
  );
}
