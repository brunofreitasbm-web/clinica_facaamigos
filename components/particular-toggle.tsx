"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/current-user-context";
import { setPatientParticular } from "@/app/actions/patient-particular";

const CAN_EDIT_PLAN = new Set(["recepcao", "supervisor", "gestor"]);

/** Papéis que podem gravar o plano do paciente (mesma regra da RLS de patient_insurance). */
export function useCanMarkParticular(): boolean {
  const user = useCurrentUser();
  return !!user && CAN_EDIT_PLAN.has(user.role ?? "");
}

/**
 * Caixinha "É particular" ao lado do nome, para o paciente sem plano identificado.
 * Um clique grava Particular em todas as telas; a pílula "Particular" que aparece
 * depois ganha um "desfazer" discreto. Fora do chat. Quem não pode gravar não vê nada.
 */
export function ParticularToggle({
  patientId,
  size = "sm",
  className = "",
}: {
  patientId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const allowed = useCanMarkParticular();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!allowed) return null;

  function onChange(checked: boolean) {
    if (!checked) return;
    setError(null);
    startTransition(async () => {
      const res = await setPatientParticular(patientId, true);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label
        className={`inline-flex cursor-pointer select-none items-center gap-1 rounded-full border border-paper-line-strong bg-paper px-2 py-0.5 font-semibold text-ink-soft hover:border-accent hover:text-ink print:hidden ${
          size === "md" ? "text-xs" : "text-[10px] leading-tight"
        } ${pending ? "opacity-60" : ""}`}
        title="Plano não identificado. Marque se o paciente é particular."
      >
        <input
          type="checkbox"
          checked={false}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3 w-3 accent-slate-600"
        />
        É particular
      </label>
      {error && (
        <span role="alert" className="text-[10px] font-medium text-status-negative-text">
          {error}
        </span>
      )}
    </span>
  );
}

/** "desfazer" ao lado da pílula Particular, só para quem pode gravar. */
export function ParticularUndo({ patientId }: { patientId: string }) {
  const allowed = useCanMarkParticular();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return null;
  return (
    <span className="inline-flex items-center gap-1 print:hidden" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await setPatientParticular(patientId, false);
            if (!res.success) setError(res.error);
            else router.refresh();
          })
        }
        className="text-[10px] font-medium text-ink-faint underline underline-offset-2 hover:text-ink disabled:opacity-60"
      >
        desfazer
      </button>
      {error && (
        <span role="alert" className="text-[10px] font-medium text-status-negative-text">
          {error}
        </span>
      )}
    </span>
  );
}
