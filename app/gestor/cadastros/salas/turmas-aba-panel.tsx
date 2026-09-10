"use client";

import { useRef, useState, useTransition } from "react";
import { createAbaClass, deleteAbaClass, setAbaClassActive } from "./turmas-aba-actions";
import { ABA_CLASS_START_TIMES, ABA_CLASS_WEEKDAYS, WEEKDAY_LABELS, toHourMinute } from "@/lib/aba-training";
import type { AbaClassRow, RoomRow } from "./types";

export function TurmasAbaPanel({ classes, rooms }: { classes: AbaClassRow[]; rooms: RoomRow[] }) {
  const abaRooms = rooms.filter((r) => r.isAbaTraining);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-faint">
        Treino ABA é um bloco de 2h (3 sessões consecutivas de 40min) atendido em turma, e paga com o saldo
        somado das guias de Psicologia ABA, Fonoaudiologia ABA, Terapia Ocupacional ABA e Psicopedagogia ABA.
        A turma é fixa — sala, dia da semana e horário de entrada (8h, 10h, 14h ou 16h) — e não tem matrícula:
        a recepção encaixa o paciente sessão a sessão enquanto houver vaga na sala e saldo nas guias. A
        capacidade da turma é a capacidade da sala.
      </p>

      {abaRooms.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--status-falta)" }}>
          Nenhuma sala marcada como sala de Treino ABA. Cadastre a sala na aba Salas Físicas e marque
          &ldquo;Sala de Treino ABA&rdquo; antes de abrir turmas.
        </p>
      ) : (
        <form
          ref={formRef}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto]"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createAbaClass(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              formRef.current?.reset();
            });
          }}
        >
          <select name="roomId" required defaultValue="" className="input">
            <option value="" disabled>
              Sala de Treino ABA…
            </option>
            {abaRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.capacity} vaga(s)
              </option>
            ))}
          </select>
          <select name="dayOfWeek" required defaultValue="" className="input">
            <option value="" disabled>
              Dia da semana…
            </option>
            {ABA_CLASS_WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABELS[d]}
              </option>
            ))}
          </select>
          <select name="startTime" required defaultValue="" className="input">
            <option value="" disabled>
              Horário…
            </option>
            {ABA_CLASS_START_TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit" disabled={isPending} className="btn btn-primary">
            {isPending ? "Salvando…" : "+ Abrir turma"}
          </button>
        </form>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Sala</th>
            <th>Dia</th>
            <th>Entrada</th>
            <th>Vagas</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {classes.map((c) => (
            <tr key={c.id}>
              <td className="font-semibold text-sm">{c.roomName}</td>
              <td>{WEEKDAY_LABELS[c.dayOfWeek]}</td>
              <td>
                {toHourMinute(c.startTime)} — bloco de 2h
              </td>
              <td>{c.capacity}</td>
              <td className="text-xs text-ink-faint">{c.active ? "Ativa" : "Inativa"}</td>
              <td className="text-right">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => setAbaClassActive(c.id, !c.active))}
                  className="text-xs text-chart"
                >
                  {c.active ? "Desativar" : "Reativar"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm(`Excluir a turma de ${WEEKDAY_LABELS[c.dayOfWeek]} ${toHourMinute(c.startTime)} em ${c.roomName}?`)) return;
                    run(() => deleteAbaClass(c.id));
                  }}
                  className="ml-3 text-xs text-status-negative-text"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
          {classes.length === 0 && (
            <tr>
              <td colSpan={6} className="text-ink-faint">
                Nenhuma turma de Treino ABA aberta ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
