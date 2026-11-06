"use client";

import { useState, useTransition } from "react";
import { revealPatientCpfAction } from "./actions";

/** CPF mascarado com ação "revelar" (auditada no servidor). Seguro dentro de <Link>. */
export function RevealCpf({ patientId, masked }: { patientId: string; masked: string }) {
  const [full, setFull] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reveal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await revealPatientCpfAction(patientId);
      if (res.success && res.cpf) setFull(res.cpf);
    });
  }

  return (
    <span>
      CPF: {full ?? masked}{" "}
      {full === null && (
        <button type="button" onClick={reveal} disabled={isPending} className="underline text-[11px]">
          {isPending ? "…" : "revelar"}
        </button>
      )}
    </span>
  );
}
