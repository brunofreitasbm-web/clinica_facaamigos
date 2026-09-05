"use client";

import { useState, useTransition } from "react";
import { createStaff } from "./actions";
import { ROLES, ROLE_LABEL } from "@/lib/roles";
import { useToast } from "@/components/toast-provider";

export function StaffForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5 sm:flex-row sm:flex-wrap sm:items-end"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            const result = await createStaff(formData);
            if (!result.success) {
              setError(result.error);
              toast(result.error, "error");
              return;
            }
            toast("Conta de usuário criada com sucesso!", "success");
            (document.getElementById("staff-form") as HTMLFormElement)?.reset();
          } catch {
            const msg = "Erro inesperado ao criar a conta. Tente de novo.";
            setError(msg);
            toast(msg, "error");
          }
        });
      }}
      id="staff-form"
    >
      <div className="flex flex-col">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="full_name">
          Nome
        </label>
        <input id="full_name" name="full_name" required className="mt-1 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required className="mt-1 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="password">
          Senha inicial
        </label>
        <input id="password" name="password" type="text" minLength={8} required className="mt-1 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="role">
          Papel
        </label>
        <select id="role" name="role" required defaultValue="" className="mt-1 rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink">
          <option value="" disabled>Escolha</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABEL[role]}</option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={isPending} className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
        {isPending ? "Criando…" : "Criar conta"}
      </button>
      {error && <p className="w-full text-xs text-status-negative-text">{error}</p>}
    </form>
  );
}
