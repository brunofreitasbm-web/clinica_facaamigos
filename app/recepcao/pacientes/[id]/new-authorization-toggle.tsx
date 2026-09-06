"use client";

// Botão "+ Nova guia" da seção fixa "Guias" (ficha do paciente) — abre o
// mesmo formulário/Server Action do passo 3 do onboarding, mas disponível em
// qualquer estágio do paciente, inclusive já ativo (renovação de guia).
import { useState } from "react";
import { StageActionForm } from "./stage-action-form";
import { AuthorizationFormFields } from "./authorization-form-fields";
import { registerAuthorization } from "./stage-actions";

export function NewAuthorizationToggle({
  patientId,
  insurers,
}: {
  patientId: string;
  insurers: { id: string; name: string }[] | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
          <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
        </svg>
        Nova guia
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <StageActionForm
        action={registerAuthorization.bind(null, patientId)}
        submitLabel="Registrar guia"
        onSuccess={() => setOpen(false)}
      >
        <AuthorizationFormFields insurers={insurers} />
      </StageActionForm>
      <button type="button" className="self-start text-xs text-ink-faint underline" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </div>
  );
}
