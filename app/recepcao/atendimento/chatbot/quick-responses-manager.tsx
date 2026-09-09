"use client";

import { useRef, useState, useTransition } from "react";
import { createQuickResponse, updateQuickResponse, deleteQuickResponse } from "../actions";

export type QuickResponseRow = { id: string; shortcut: string; title: string; contentText: string };

function QuickResponseRowView({ response }: { response: QuickResponseRow }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(response.title);
  const [contentText, setContentText] = useState(response.contentText);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr>
        <td colSpan={3}>
          <div className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper/60 p-4">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do botão" />
            <textarea
              className="input"
              rows={3}
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Texto que será enviado ao clicar"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await updateQuickResponse(response.id, title, contentText);
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
            </div>
            {error && <p className="text-xs text-status-negative-text">{error}</p>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-semibold text-chart">{response.shortcut}</td>
      <td>
        <div className="font-semibold">{response.title}</div>
        <div className="text-xs text-ink-faint">{response.contentText}</div>
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs text-status-negative-text"
            disabled={isPending}
            onClick={() => {
              if (confirm(`Excluir a resposta rápida "${response.title}"?`)) {
                startTransition(async () => {
                  await deleteQuickResponse(response.id);
                });
              }
            }}
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

export function QuickResponsesManager({ clinicId, responses }: { clinicId: string; responses: QuickResponseRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <h3 className="mb-1">Respostas Rápidas</h3>
      <p className="mb-6 text-sm text-ink-soft">
        Atalhos de texto que aparecem como botões acima da caixa de mensagem e no menu &quot;/&quot; da Central de
        Atendimento — úteis para respostas repetitivas (endereço, valores, convênios) que a recepção envia manualmente.
      </p>

      <table className="table mb-6">
        <thead>
          <tr>
            <th>Atalho</th>
            <th>Título / Texto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {responses.map((r) => (
            <QuickResponseRowView key={r.id} response={r} />
          ))}
          {responses.length === 0 && (
            <tr>
              <td colSpan={3} className="text-ink-faint">
                Nenhuma resposta rápida cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        ref={formRef}
        className="grid max-w-[640px] grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5"
        action={(formData) => {
          setError(null);
          const shortcut = String(formData.get("shortcut") ?? "").trim();
          const title = String(formData.get("title") ?? "").trim();
          const contentText = String(formData.get("contentText") ?? "").trim();
          if (!shortcut || !title || !contentText) {
            setError("Preencha atalho, título e texto.");
            return;
          }
          startTransition(async () => {
            const result = await createQuickResponse(clinicId, shortcut, title, contentText);
            if (!result.success) {
              setError(result.error);
              return;
            }
            formRef.current?.reset();
          });
        }}
      >
        <input name="shortcut" required placeholder="Atalho (ex.: endereco — a barra é adicionada automaticamente)" className="input" />
        <input name="title" required placeholder="Título do botão (ex.: Endereço)" className="input" />
        <textarea name="contentText" required rows={3} placeholder="Texto enviado ao clicar" className="input" />
        <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
          {isPending ? "Adicionando…" : "+ Adicionar resposta rápida"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </form>
    </div>
  );
}
