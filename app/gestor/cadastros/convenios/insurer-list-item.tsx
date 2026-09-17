"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { HealthPlanBadge } from "@/components/health-plan-badge";
import { useToast } from "@/components/toast-provider";
import { updateInsurer, deleteInsurer } from "./actions";

interface InsurerItemProps {
  insurer: {
    id: string;
    name: string;
    ans_code: string | null;
    badge_color: string | null;
  };
}

const COLOR_OPTIONS = [
  { value: "emerald", label: "Verde", hex: "#10b981" },
  { value: "sky", label: "Azul", hex: "#0ea5e9" },
  { value: "violet", label: "Roxo", hex: "#8b5cf6" },
  { value: "amber", label: "Laranja", hex: "#f59e0b" },
  { value: "rose", label: "Rosa / Vermelho", hex: "#f43f5e" },
  { value: "teal", label: "Verde-água", hex: "#14b8a6" },
  { value: "indigo", label: "Índigo", hex: "#6366f1" },
  { value: "slate", label: "Cinza", hex: "#64748b" },
];

export function InsurerListItem({ insurer }: InsurerItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [name, setName] = useState(insurer.name);
  const [ansCode, setAnsCode] = useState(insurer.ans_code ?? "");
  const [badgeColor, setBadgeColor] = useState(insurer.badge_color ?? "emerald");

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateInsurer(insurer.id, formData);
      if (!res.success) {
        toast(res.error, "error");
        return;
      }
      toast("Plano de saúde atualizado com sucesso.", "success");
      setIsEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteInsurer(insurer.id);
      if (!res.success) {
        toast(res.error, "error");
        setIsDeleting(false);
        return;
      }
      toast("Plano de saúde excluído com sucesso.", "success");
      setIsDeleting(false);
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <HealthPlanBadge name={insurer.name} color={insurer.badge_color} size="md" />
        <span className="font-semibold text-ink">{insurer.name}</span>
        {insurer.ans_code && (
          <span className="text-xs text-ink-faint">ANS {insurer.ans_code}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/gestor/cadastros/convenios/${insurer.id}/precos`}
          className="text-xs font-medium text-chart hover:underline mr-2"
        >
          Tabela de preços
        </Link>

        <Link
          href={`/gestor/cadastros/convenios/${insurer.id}/procedimentos`}
          className="text-xs font-medium text-chart hover:underline mr-2"
        >
          Códigos de Procedimento
        </Link>

        {/* Botão de Editar */}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          title="Editar plano de saúde"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-paper-line text-ink-soft hover:bg-neutral-100 hover:text-accent transition-colors"
        >
          <Pencil size={14} />
          <span>Editar</span>
        </button>

        {/* Botão de Excluir */}
        <button
          type="button"
          onClick={() => setIsDeleting(true)}
          title="Excluir plano de saúde"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={14} />
          <span>Excluir</span>
        </button>
      </div>

      {/* Modal de Edição */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong mb-4">
              Editar Plano de Saúde
            </h2>
            <form action={handleUpdate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="name">
                  Nome do Plano de Saúde *
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="ans_code">
                  Código ANS
                </label>
                <input
                  id="ans_code"
                  name="ans_code"
                  className="input"
                  placeholder="Ex: 123456"
                  value={ansCode}
                  onChange={(e) => setAnsCode(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="badge_color">
                  Cor da pílula / badge
                </label>
                <select
                  id="badge_color"
                  name="badge_color"
                  className="input cursor-pointer"
                  value={badgeColor}
                  onChange={(e) => setBadgeColor(e.target.value)}
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-paper-line mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isPending}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? "Salvando…" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
            <h2 className="text-base font-semibold text-ink-strong">Excluir Plano de Saúde?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Tem certeza que deseja excluir o plano <strong>{insurer.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                disabled={isPending}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="btn text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-700"
              >
                {isPending ? "Excluindo…" : "Excluir Plano"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
