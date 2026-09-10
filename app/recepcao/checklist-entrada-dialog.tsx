"use client";

import Link from "next/link";
import { useState } from "react";
import type { IntakeChecklistRow } from "@/lib/intake-checklist";

/**
 * Painel do checklist de entrada. Antes eram 6 checkboxes de estado local:
 * marcar não gravava nada e o painel dizia "6 de 6 concluídos" com zero
 * documento anexado. Agora cada item reflete a existência do documento em
 * `documents` — a mesma leitura que alimenta a meta `intake_complete_rate`
 * da recepção (§10.1), então o que aparece aqui é o que conta no PLR.
 * Concluir um item = anexar o documento na ficha do paciente.
 */
export function ChecklistEntradaDialog({ rows }: { rows: IntakeChecklistRow[] }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.patientId ?? null);

  const selected = rows.find((r) => r.patientId === selectedId) ?? rows[0] ?? null;
  const pendingCount = rows.filter((r) => !r.complete).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E81E61] bg-white px-3.5 py-2 text-xs font-semibold text-[#E81E61] shadow-xs transition-all hover:bg-[#E81E61]/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#E81E61] focus-visible:outline-offset-2"
      >
        📋 Checklist de Entrada
        {pendingCount > 0 && (
          <span className="rounded-full bg-[#E81E61] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between border-b pb-3">
              <div>
                <h3 style={{ fontFamily: "var(--font-heading)" }} className="text-base font-bold text-neutral-900">
                  Checklist de Entrada
                </h3>
                <p className="text-xs text-neutral-500">
                  Documentos obrigatórios antes da 1ª sessão · conta na meta da recepção
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            {rows.length === 0 || !selected ? (
              <p className="py-6 text-center text-xs text-neutral-500">
                Nenhum paciente aguardando a 1ª sessão no momento.
              </p>
            ) : (
              <>
                <label className="mb-3 block text-xs font-semibold text-neutral-700">
                  Paciente
                  <select
                    value={selected.patientId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-2 text-xs font-normal text-neutral-800"
                  >
                    {rows.map((r) => (
                      <option key={r.patientId} value={r.patientId}>
                        {r.complete ? "✅" : "⏳"} {r.patientName} ({r.doneCount}/{r.requiredCount})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mb-4 flex items-center justify-between rounded-lg bg-neutral-100 p-3">
                  <span className="text-xs font-semibold text-neutral-700">Anexos na ficha</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selected.complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selected.doneCount} de {selected.requiredCount} concluídos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selected.items.map((item, index) => (
                    <div
                      key={item.category}
                      className={`flex items-center gap-3 rounded-md border p-2.5 text-xs ${
                        item.required ? "" : "opacity-50"
                      }`}
                    >
                      <span aria-hidden className="text-sm">
                        {!item.required ? "—" : item.done ? "✅" : "⬜"}
                      </span>
                      <div>
                        <span className="font-semibold text-neutral-800">
                          {index + 1}. {item.label}
                        </span>
                        <p className="text-[11px] text-neutral-500">
                          {item.required
                            ? item.hint
                            : "Não se aplica — paciente particular, sem convênio."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[11px] text-neutral-500">
                  Um item só fica concluído quando o documento é anexado na ficha do paciente.
                </p>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Fechar
                  </button>
                  <Link
                    href={`/recepcao/pacientes/${selected.patientId}`}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    Abrir ficha e anexar
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
