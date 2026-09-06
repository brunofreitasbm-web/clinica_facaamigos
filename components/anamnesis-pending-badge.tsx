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
    <Link
      href="/supervisao"
      className="mb-8 flex items-center gap-3 rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm no-underline"
    >
      <ShieldCheck size={16} className="text-accent" />
      <span className="text-ink">
        <strong>{count}</strong> {count === 1 ? "solicitação de anamnese aguardando" : "solicitações de anamnese aguardando"} validação clínica na Supervisão
      </span>
    </Link>
  );
}
