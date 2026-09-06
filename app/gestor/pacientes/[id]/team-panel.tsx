"use client";

import { useState, useTransition } from "react";
import { addTeamMember, revokeTeamMember } from "./actions";

export type TeamMemberRow = {
  id: string;
  profileName: string;
  roleInTeam: "terapeuta_avaliador" | "supervisor_area" | "rt" | null;
  discipline: string | null;
};

export type ProfileOption = { id: string; full_name: string };

const ROLE_LABEL: Record<string, string> = {
  terapeuta_avaliador: "Terapeuta avaliador",
  supervisor_area: "Supervisor de área",
  rt: "Responsável técnico",
};

/**
 * Equipe de avaliação do paciente (Módulo 3 MAAIS, slide 23). Precisa de ao
 * menos 1 terapeuta avaliador + 1 supervisor de área pra concluir a etapa
 * "equipe_definida" do checklist de entrada.
 */
export function TeamPanel({
  patientId,
  members,
  candidates,
}: {
  patientId: string;
  members: TeamMemberRow[];
  candidates: ProfileOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addTeamMember(patientId, formData);
      if (!result.success) setError(result.error);
    });
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      await revokeTeamMember(patientId, memberId);
    });
  }

  return (
    <div id="equipe" className="card max-w-[720px] scroll-mt-6">
      <div className="card-kicker">Equipe de avaliação</div>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-semibold">{m.profileName}</span>
              {m.roleInTeam && <span className="text-ink-soft"> · {ROLE_LABEL[m.roleInTeam] ?? m.roleInTeam}</span>}
              {m.discipline && <span className="text-ink-faint"> · {m.discipline}</span>}
            </span>
            <button type="button" disabled={isPending} onClick={() => handleRemove(m.id)} className="btn btn-ghost text-xs">
              Remover
            </button>
          </li>
        ))}
        {members.length === 0 && <li className="text-sm text-ink-faint">Nenhum profissional definido ainda.</li>}
      </ul>

      <form action={handleAdd} className="mt-4 flex flex-wrap items-end gap-2">
        <select name="profile_id" required className="input">
          <option value="">Profissional…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        <select name="role_in_team" required className="input">
          <option value="">Papel…</option>
          <option value="terapeuta_avaliador">Terapeuta avaliador</option>
          <option value="supervisor_area">Supervisor de área</option>
        </select>
        <input name="discipline" placeholder="Disciplina (opcional)" className="input" />
        <button type="submit" disabled={isPending} className="btn btn-primary text-sm">
          Adicionar
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-status-negative-text">{error}</p>}
    </div>
  );
}
