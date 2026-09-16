"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getPendingAnamnesisRequestsAction } from "@/app/actions/anamnesis-chatbot";

/**
 * Aprovar/rejeitar laudo de anamnese é decisão clínica — fica só no painel
 * de Triagens da Supervisão (AnamnesisValidationPanel). Aqui a recepção só
 * vê quantas solicitações estão esperando, sem poder decidir.
 */
export function AnamnesisPendingBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    getPendingAnamnesisRequestsAction().then((res) => {
      if (res.success && res.requests) {
        setCount(res.requests.filter((r) => r.status === "pendente_supervisor").length);
      }
    });
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/90 p-3.5 shadow-2xs transition-all" role="alert" aria-live="polite">
      <Link
        href="/supervisao"
        className="flex items-center justify-between gap-3 text-sm no-underline text-amber-900 hover:text-amber-950"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={18} className="text-amber-600 shrink-0" />
          <span className="font-medium">
            <strong>{count}</strong> {count === 1 ? "solicitação de anamnese aguardando" : "solicitações de anamnese aguardando"} validação clínica na Supervisão
          </span>
        </div>
        <span className="text-xs font-semibold text-amber-700 underline shrink-0 hover:text-amber-900">
          Ver na Supervisão →
        </span>
      </Link>
    </div>
  );
}

