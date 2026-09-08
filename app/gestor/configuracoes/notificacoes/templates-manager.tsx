"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTemplate, toggleTemplateActive, toggleMetaApproved } from "./actions";

export type TemplateRow = {
  id: string;
  category: string;
  name: string;
  channel: string;
  body: string;
  meta_approved: boolean;
  active: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  confirmacao_d1: "Confirmação D-1",
  falta: "Alerta de Falta",
  cobranca: "Cobrança",
  aniversario: "Aniversário",
  renovacao_guia: "Renovação de Guia",
  outro: "Outro",
};

function NewTemplateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createTemplate(new FormData(e.currentTarget));
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
        <Plus size={16} /> Novo Modelo
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)" }}>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Categoria
          <select name="category" required className="input" defaultValue="outro">
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Canal
          <select name="channel" className="input" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
        Nome do modelo
        <input type="text" name="name" required className="input" placeholder="Ex.: Lembrete de confirmação D-1" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
        Texto (use {"{{nome}}"}, {"{{data}}"}, {"{{horario}}"} como variáveis)
        <textarea name="body" required rows={3} className="input" />
      </label>
      {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Salvando…" : "Salvar Modelo"}
        </button>
      </div>
    </form>
  );
}

function TemplateRowView({ template }: { template: TemplateRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <tr>
      <td className="font-semibold">{template.name}</td>
      <td className="text-xs">{CATEGORY_LABEL[template.category] ?? template.category}</td>
      <td className="text-xs uppercase">{template.channel}</td>
      <td className="max-w-sm truncate text-xs text-ink-soft" title={template.body}>
        {template.body}
      </td>
      <td>
        <button
          type="button"
          className={`tag-status ${template.meta_approved ? "st-realizada" : "st-agendada"}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await toggleMetaApproved(template.id, !template.meta_approved);
              router.refresh();
            })
          }
        >
          {template.meta_approved ? "Aprovado (Meta)" : "Marcar aprovado"}
        </button>
      </td>
      <td>
        <button
          type="button"
          className={`tag-status ${template.active ? "st-realizada" : "st-cancelada"}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await toggleTemplateActive(template.id, !template.active);
              router.refresh();
            })
          }
        >
          {template.active ? "Ativo" : "Inativo"}
        </button>
      </td>
    </tr>
  );
}

export function TemplatesManager({ templates }: { templates: TemplateRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <NewTemplateForm />
      {templates.length === 0 ? (
        <p className="text-sm text-ink-faint">Nenhum modelo cadastrado ainda.</p>
      ) : (
        <table className="table w-full">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Canal</th>
              <th>Texto</th>
              <th>Aprovação Meta</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <TemplateRowView key={t.id} template={t} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
