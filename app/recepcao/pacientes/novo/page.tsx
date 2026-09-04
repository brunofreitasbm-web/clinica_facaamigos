"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createLead } from "../actions";

export default function NovoPacientePage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Novo paciente"
        description="Cadastro mínimo — meta é 30 segundos. Resto dos dados vem depois, na ficha do paciente."
      />
      <form
        className="flex max-w-xl flex-col gap-4 p-6 sm:p-10"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createLead(formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            router.push(`/recepcao/pacientes/${result.patientId}`);
          });
        }}
      >
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="child_name">
            Nome da criança
          </label>
          <input id="child_name" name="child_name" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="birth_date">
            Data de nascimento
          </label>
          <input id="birth_date" name="birth_date" type="date" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="guardian_name">
            Nome do responsável
          </label>
          <input id="guardian_name" name="guardian_name" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="guardian_phone">
            Telefone do responsável
          </label>
          <input id="guardian_phone" name="guardian_phone" required className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="entry_source">
            Origem
          </label>
          <input id="entry_source" name="entry_source" placeholder="WhatsApp, Instagram, indicação…" className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="complaint">
            Queixa em uma linha
          </label>
          <input id="complaint" name="complaint" className="mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <button type="submit" disabled={isPending} className="self-start rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
          {isPending ? "Salvando…" : "Cadastrar"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </form>
    </main>
  );
}
