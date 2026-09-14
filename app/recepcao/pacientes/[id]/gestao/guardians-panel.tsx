"use client";

import { useState, useTransition } from "react";
import { updateGuardianEmail, updateGuardianCalendarOptIn } from "./actions";

export type GuardianRow = {
  id: string;
  fullName: string;
  relationship: string | null;
  email: string | null;
  googleCalendarOptIn: boolean;
};

/**
 * Convite de agenda por Google Calendar (supabase/functions/
 * sync-google-calendar): cada responsável com opt-in ativo entra como
 * convidado no evento do atendimento, com o nome da criança no título —
 * um paciente pode ter mais de um responsável, todos no mesmo evento.
 */
export function GuardiansPanel({ patientId, guardians }: { patientId: string; guardians: GuardianRow[] }) {
  return (
    <div id="convites-agenda" className="card max-w-[720px] scroll-mt-6">
      <div className="card-kicker">Convites de agenda (Google Calendar)</div>
      <p className="text-xs text-ink-soft mb-3">
        Quando ativado, o responsável recebe um convite de calendário por e-mail para cada atendimento
        agendado, reagendado ou cancelado. Funciona melhor com contas Gmail/Google Workspace — outros
        provedores de e-mail também recebem o convite, mas sem a integração automática ao calendário.
      </p>
      <ul className="flex flex-col gap-3">
        {guardians.map((g) => (
          <GuardianRowItem key={g.id} patientId={patientId} guardian={g} />
        ))}
        {guardians.length === 0 && (
          <li className="text-sm text-ink-faint">Nenhum responsável cadastrado ainda.</li>
        )}
      </ul>
    </div>
  );
}

function GuardianRowItem({ patientId, guardian }: { patientId: string; guardian: GuardianRow }) {
  const [email, setEmail] = useState(guardian.email ?? "");
  const [optIn, setOptIn] = useState(guardian.googleCalendarOptIn);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveEmail() {
    setError(null);
    startTransition(async () => {
      const result = await updateGuardianEmail(patientId, guardian.id, email);
      if (!result.success) setError(result.error);
    });
  }

  function handleToggleOptIn(checked: boolean) {
    setError(null);
    setOptIn(checked);
    startTransition(async () => {
      const result = await updateGuardianCalendarOptIn(patientId, guardian.id, checked);
      if (!result.success) {
        setError(result.error);
        setOptIn(!checked);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-end gap-3 rounded-md border border-paper-line-strong bg-paper px-4 py-3">
      <div className="flex-1 basis-40">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">Responsável</span>
        <p className="mt-1 text-sm font-semibold text-ink-strong">
          {guardian.fullName}
          {guardian.relationship && <span className="text-ink-faint font-normal"> · {guardian.relationship}</span>}
        </p>
      </div>
      <div className="flex-1 basis-56">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">E-mail</label>
        <div className="flex gap-2 mt-1">
          <input
            type="email"
            className="input"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleSaveEmail}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-strong pb-1">
        <input
          type="checkbox"
          checked={optIn}
          disabled={isPending || !email.trim()}
          onChange={(e) => handleToggleOptIn(e.target.checked)}
        />
        Enviar convites de agenda
      </label>
      {error && <p className="w-full text-xs text-status-negative-text">{error}</p>}
    </li>
  );
}
