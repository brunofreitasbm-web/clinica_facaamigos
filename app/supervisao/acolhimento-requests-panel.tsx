"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markGradeDefined } from "./acolhimento-requests-actions";

export type GradePendingRequestRow = {
  id: string;
  patientId: string;
  patientName: string;
};

/**
 * Seção "Definir grade fixa" — acolhimentos (FASE 4, acolhimento_requests)
 * que já foram realizados/contratados e só faltam ganhar um horário fixo
 * semanal. Cada linha linka pra Grade (grade-panel.tsx, mesma aba da
 * Supervisão) pra definir o(s) slot(s), e markGradeDefined fecha a etapa do
 * checklist + avança o status do acolhimento.
 */
export function AcolhimentoRequestsPanel({ requests }: { requests: GradePendingRequestRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) {
    return <p className="text-sm text-ink-faint">Nenhum acolhimento aguardando definição de grade no momento.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">
        Acolhimentos com contrato/pagamento já resolvidos, aguardando a Supervisão definir o(s) horário(s) fixo(s)
        semanais. Defina o horário na aba Grade e depois marque como concluído aqui.
      </p>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-md border border-paper-line-strong bg-white p-3 text-sm"
          >
            <Link href={`/recepcao/pacientes/${r.patientId}`} className="font-semibold text-chart hover:underline">
              {r.patientName}
            </Link>
            <button
              type="button"
              disabled={isPending}
              className="rounded-md bg-chart px-3 py-1.5 text-xs font-semibold text-white hover:bg-chart-strong disabled:opacity-50"
              onClick={() =>
                startTransition(async () => {
                  await markGradeDefined(r.id);
                  router.refresh();
                })
              }
            >
              {isPending ? "Salvando…" : "Marcar grade definida"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
