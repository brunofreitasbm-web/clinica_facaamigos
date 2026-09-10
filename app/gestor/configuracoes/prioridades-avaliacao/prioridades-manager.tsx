"use client";

import { useRef, useState, useTransition } from "react";
import { ConfigSidebar } from "../config-sidebar";
import { createPriority, updatePriority, togglePriorityActive, deletePriority } from "./actions";
import { PageContainer } from "@/components/page-container";

export type PriorityRow = {
  id: string;
  insurance_id: string;
  priority_level: number;
  label: string;
  description: string;
  color: string;
  active: boolean;
};

type InsurerOption = { id: string; name: string };

const PRIORITY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

function PriorityRowView({
  priority,
  insurers,
}: {
  priority: PriorityRow;
  insurers: InsurerOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(priority.label);
  const [description, setDescription] = useState(priority.description);
  const [color, setColor] = useState(priority.color);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const insurerName = insurers.find((i) => i.id === priority.insurance_id)?.name || "—";

  return (
    <tr>
      <td className="text-ink-faint text-sm">{insurerName}</td>
      <td>
        {editing ? (
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded"
              style={{ backgroundColor: color }}
            />
            <input
              type="number"
              className="input w-20"
              min="1"
              max="10"
              value={priority.priority_level}
              disabled
              title="O nível de prioridade não pode ser alterado"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded"
              style={{ backgroundColor: priority.color }}
            />
            <span>{priority.priority_level}</span>
          </div>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="input"
            style={{ minWidth: 200 }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Alta prioridade"
          />
        ) : (
          <span className={priority.active ? "" : "text-ink-faint line-through"}>
            {priority.label}
          </span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="input"
            style={{ minWidth: 250 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição opcional"
          />
        ) : (
          <span className="text-ink-soft text-sm">{priority.description || "—"}</span>
        )}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await updatePriority(priority.id, {
                      label,
                      description,
                      color,
                    });
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
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => {
                  setLabel(priority.label);
                  setDescription(priority.description);
                  setColor(priority.color);
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setEditing(true)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void togglePriorityActive(priority.id, !priority.active);
                  })
                }
              >
                {priority.active ? "Desativar" : "Reativar"}
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-status-negative-text">{error}</p>
        )}
      </td>
    </tr>
  );
}

export function PrioridadesAvaliacaoManager({
  priorities,
  insurers,
}: {
  priorities: PriorityRow[];
  insurers: InsurerOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedColor, setSelectedColor] = useState(PRIORITY_COLORS[0]);
  const [selectedInsurer, setSelectedInsurer] = useState(
    insurers[0]?.id || ""
  );

  const nextPriorityLevel = Math.max(
    ...(priorities.filter((p) => p.insurance_id === selectedInsurer).map((p) => p.priority_level) || [0])
  ) + 1;

  const maxLevelReached =
    priorities.filter((p) => p.insurance_id === selectedInsurer).length >= 10;

  return (
    <div className="flex flex-1">
      <ConfigSidebar active="prioridades" />
      <PageContainer>
        <h1 className="mb-1">Prioridades de Agendamento de 1ª Avaliação</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Configure os níveis de prioridade para agendar avaliações iniciais de
          pacientes de cada plano de saúde. Cada convênio pode ter até 10 níveis
          de prioridade diferentes.
        </p>

        {priorities.length > 0 ? (
          <table className="table mb-8">
            <thead>
              <tr>
                <th>Plano de Saúde</th>
                <th>Nível</th>
                <th>Rótulo</th>
                <th>Descrição</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {priorities.map((p) => (
                <PriorityRowView key={p.id} priority={p} insurers={insurers} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mb-8 rounded-md border border-paper-line-strong bg-paper/60 p-6 text-center text-ink-faint">
            Nenhuma prioridade de avaliação cadastrada ainda.
          </div>
        )}

        <form
          ref={formRef}
          className="grid max-w-[600px] grid-cols-1 gap-4 rounded-md border border-paper-line-strong bg-paper/60 p-5"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createPriority(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
              setSelectedColor(PRIORITY_COLORS[0]);
              setSelectedInsurer(insurers[0]?.id || "");
            });
          }}
        >
          <div>
            <label className="block mb-2 text-sm font-medium">
              Plano de Saúde
            </label>
            <select
              name="insurance_id"
              required
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              className="input w-full"
            >
              <option value="">Selecione um convênio</option>
              {insurers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Nível</label>
              <input
                type="number"
                name="priority_level"
                required
                min="1"
                max="10"
                value={nextPriorityLevel}
                disabled
                className="input w-full"
                title="O nível é preenchido automaticamente"
              />
              <input type="hidden" name="priority_level" value={nextPriorityLevel} />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Cor</label>
              <div className="flex gap-2">
                {PRIORITY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      selectedColor === c
                        ? "border-ink-strong"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setSelectedColor(c);
                      const input = formRef.current?.querySelector(
                        "input[name='color']"
                      ) as HTMLInputElement | null;
                      if (input) input.value = c;
                    }}
                  />
                ))}
              </div>
              <input type="hidden" name="color" value={selectedColor} />
            </div>
          </div>

          <input
            name="label"
            required
            placeholder="Rótulo (ex: Alta Prioridade)"
            className="input"
          />

          <input
            name="description"
            placeholder="Descrição (opcional)"
            className="input"
          />

          <button
            type="submit"
            disabled={isPending || !selectedInsurer || maxLevelReached}
            className="btn btn-primary w-fit"
            title={
              maxLevelReached
                ? "Limite de 10 prioridades por convênio atingido"
                : undefined
            }
          >
            {isPending
              ? "Adicionando…"
              : "+ Adicionar prioridade"}
          </button>

          {error && (
            <p className="text-xs text-status-negative-text">{error}</p>
          )}
        </form>
      </PageContainer>
    </div>
  );
}
