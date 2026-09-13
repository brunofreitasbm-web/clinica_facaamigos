"use client";

import { useState, useTransition } from "react";
import { createInsurer } from "./actions";
import { HealthPlanBadge } from "@/components/health-plan-badge";

const COLOR_OPTIONS = [
  { label: "Verde (Unimed)", value: "#16a34a" },
  { label: "Vermelho (Amazônia)", value: "#dc2626" },
  { label: "Roxo (Yazév)", value: "#7c3aed" },
  { label: "Azul (Amil)", value: "#2563eb" },
  { label: "Laranja (SulAmérica)", value: "#ea580c" },
  { label: "Teal (Cassi)", value: "#0d9488" },
  { label: "Cinza (Particular)", value: "#64748b" },
];

export function InsurerForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#16a34a");

  return (
    <form
      className="flex flex-col gap-4 rounded-md border border-paper-line-strong bg-paper/60 p-5"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createInsurer(formData);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setName("");
          (document.getElementById("insurer-form") as HTMLFormElement)?.reset();
        });
      }}
      id="insurer-form"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="name">
            Nome do convênio
          </label>
          <input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Unimed, Amazônia, Yazév..."
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="sm:w-36">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="ans_code">
            Código ANS
          </label>
          <input
            id="ans_code"
            name="ans_code"
            placeholder="Ex: 123456"
            className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="sm:w-48">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="badge_color">
            Cor da Pílula / Badge
          </label>
          <div className="mt-1 flex items-center gap-2">
            <select
              id="badge_color"
              name="badge_color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full rounded-md border border-paper-line-strong bg-paper px-2.5 py-2 text-sm text-ink"
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded border border-paper-line p-0.5"
              title="Escolher cor personalizada"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50 sm:self-end"
        >
          {isPending ? "Salvando…" : "Adicionar Convênio"}
        </button>
      </div>

      {name && (
        <div className="flex items-center gap-2 text-xs text-ink-soft border-t border-paper-line pt-2">
          <span>Prévia visual da pílula ao lado do nome do paciente:</span>
          <HealthPlanBadge name={name} color={color} size="sm" />
        </div>
      )}

      {error && <p className="text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
