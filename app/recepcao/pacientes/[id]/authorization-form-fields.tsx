"use client";

// Campos do formulário de guia/autorização — compartilhados entre o passo 3
// do checklist de onboarding e a seção fixa "Guias" (sempre visível, inclusive
// para pacientes já ativos). Ambos usam a mesma Server Action
// `registerAuthorization` (./stage-actions.ts).
//
// Uma guia pode autorizar mais de um procedimento (ex.: fono + psicologia na
// mesma guia), cada um com sua própria quantidade de sessões — por isso os
// campos de procedimento/sessões são uma lista repetível (procedure_code[] /
// sessions_authorized[]), enquanto convênio, número da guia e vigência valem
// pra guia como um todo. A action grava uma linha em `authorizations` por
// procedimento, todas com o mesmo guide_number.
import { useState } from "react";

export function AuthorizationFormFields({
  insurers,
}: {
  insurers: { id: string; name: string }[] | null;
}) {
  const [procedureRows, setProcedureRows] = useState([0]);

  return (
    <>
      <select name="insurer_id" required className="input">
        <option value="">Convênio</option>
        {(insurers ?? []).map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>
      <input type="text" name="guide_number" placeholder="Número da guia" className="input" />

      <div className="flex flex-col gap-2">
        {procedureRows.map((rowId, index) => (
          <div key={rowId} className="flex items-center gap-2">
            <input
              type="text"
              name="procedure_code"
              required
              placeholder="Código do procedimento"
              className="input flex-1"
            />
            <input
              type="number"
              name="sessions_authorized"
              required
              placeholder="Sessões autorizadas"
              className="input flex-1"
            />
            {procedureRows.length > 1 && (
              <button
                type="button"
                aria-label="Remover procedimento"
                className="text-xs text-ink-faint underline"
                onClick={() => setProcedureRows((rows) => rows.filter((id) => id !== rowId))}
              >
                Remover
              </button>
            )}
            {index === procedureRows.length - 1 && (
              <button
                type="button"
                className="text-xs text-chart underline"
                onClick={() => setProcedureRows((rows) => [...rows, Date.now()])}
              >
                + Procedimento
              </button>
            )}
          </div>
        ))}
      </div>

      <input type="date" name="valid_from" required className="input" />
      <input type="date" name="valid_to" required className="input" />
      <input type="text" name="authorization_password" placeholder="Senha de autorização" className="input" />
      <input type="date" name="password_valid_until" placeholder="Validade da senha" className="input" />
      <input type="text" name="cid" placeholder="CID" className="input" />
    </>
  );
}
