"use client";

import { useRef, useState, useTransition } from "react";
import { CadastrosSidebar } from "../cadastros-sidebar";
import { createBehavior, renameBehaviorLabel, toggleBehaviorActive } from "./actions";
import { PageContainer } from "@/components/page-container";

export type BehaviorRow = {
  id: string;
  value: string;
  label: string;
  discipline: string | null;
  active: boolean;
};

function BehaviorRowView({ behavior }: { behavior: BehaviorRow }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(behavior.label);
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
          <span className={behavior.active ? "" : "text-ink-faint line-through"}>{behavior.label}</span>
        )}
      </td>
      <td className="text-ink-faint">
        <code className="text-xs">{behavior.value}</code>
      </td>
      <td>{behavior.discipline ?? <span className="text-ink-faint">todas</span>}</td>
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
                    const result = await renameBehaviorLabel(behavior.id, fd);
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
                    void toggleBehaviorActive(behavior.id, !behavior.active);
                  })
                }
              >
                {behavior.active ? "Desativar" : "Reativar"}
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-status-negative-text">{error}</p>}
      </td>
    </tr>
  );
}

export function ComportamentosManager({ behaviors }: { behaviors: BehaviorRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-1">
      <CadastrosSidebar active="comportamentos" />
      <PageContainer>
        <h1 className="mb-1">Comportamentos-alvo</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Lista de comportamentos-alvo que aparece no formulário de evolução do terapeuta. Um
          comportamento já usado em alguma evolução assinada não pode ser apagado — desative-o em vez disso; o
          nome (rótulo) pode ser corrigido a qualquer momento.
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
            {behaviors.map((b) => (
              <BehaviorRowView key={b.id} behavior={b} />
            ))}
            {behaviors.length === 0 && (
              <tr>
                <td colSpan={4} className="text-ink-faint">
                  Nenhum comportamento cadastrado ainda.
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
              const result = await createBehavior(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
            });
          }}
        >
          <input name="label" required placeholder="Nome do comportamento" className="input sm:col-span-2" />
          <input
            name="discipline"
            placeholder="Disciplina (opcional — vazio = todas)"
            className="input sm:col-span-2"
          />
          <button type="submit" disabled={isPending} className="btn btn-primary sm:col-span-2 w-fit">
            {isPending ? "Adicionando…" : "+ Adicionar comportamento"}
          </button>
          {error && <p className="text-xs text-status-negative-text sm:col-span-2">{error}</p>}
        </form>
      </PageContainer>
    </div>
  );
}
