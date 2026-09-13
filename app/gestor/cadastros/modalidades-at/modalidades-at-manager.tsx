"use client";

import { useRef, useState, useTransition } from "react";
import { createAtModality, toggleAtModalityActive } from "./actions";
import { PageContainer } from "@/components/page-container";

export type AtModalityRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

function ModalityRowView({ modality }: { modality: AtModalityRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr>
      <td>
        <span className={modality.active ? "" : "text-ink-faint line-through"}>{modality.name}</span>
      </td>
      <td className="text-ink-faint">{modality.description ?? "—"}</td>
      <td className="text-right">
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void toggleAtModalityActive(modality.id, !modality.active);
            })
          }
        >
          {modality.active ? "Desativar" : "Reativar"}
        </button>
      </td>
    </tr>
  );
}

export function ModalidadesAtManager({ modalities }: { modalities: AtModalityRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-1">
      <PageContainer>
        <h1 className="mb-1">Modalidades de AT</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Lista de modalidades de Acompanhamento Terapêutico (escolar, domiciliar, comunitária,
          clínica, entre outras) usada no registro de sessão em campo. Uma modalidade já usada em
          algum registro não pode ser apagada — desative-a em vez disso.
        </p>

        <table className="table mb-6">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {modalities.map((m) => (
              <ModalityRowView key={m.id} modality={m} />
            ))}
            {modalities.length === 0 && (
              <tr>
                <td colSpan={3} className="text-ink-faint">
                  Nenhuma modalidade de AT cadastrada ainda.
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
              const result = await createAtModality(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
            });
          }}
        >
          <input name="name" required placeholder="Nome da modalidade (ex: Escolar)" className="input" />
          <input name="description" placeholder="Descrição (opcional)" className="input" />
          <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
            {isPending ? "Adicionando…" : "+ Adicionar modalidade"}
          </button>
          {error && <p className="text-xs text-status-negative-text">{error}</p>}
        </form>
      </PageContainer>
    </div>
  );
}
