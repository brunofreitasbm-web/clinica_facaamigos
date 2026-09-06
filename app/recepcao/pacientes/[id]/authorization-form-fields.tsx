// Campos do formulário de guia/autorização — compartilhados entre o passo 3
// do checklist de onboarding e a seção fixa "Guias" (sempre visível, inclusive
// para pacientes já ativos). Ambos usam a mesma Server Action
// `registerAuthorization` (./stage-actions.ts).
export function AuthorizationFormFields({
  insurers,
}: {
  insurers: { id: string; name: string }[] | null;
}) {
  return (
    <>
      <select name="insurer_id" required className="input">
        <option value="">Convênio</option>
        {(insurers ?? []).map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>
      <input type="text" name="guide_number" placeholder="Número da guia" className="input" />
      <input type="text" name="procedure_code" required placeholder="Código do procedimento" className="input" />
      <input type="number" name="sessions_authorized" required placeholder="Sessões autorizadas" className="input" />
      <input type="date" name="valid_from" required className="input" />
      <input type="date" name="valid_to" required className="input" />
      <input type="text" name="authorization_password" placeholder="Senha de autorização" className="input" />
      <input type="date" name="password_valid_until" placeholder="Validade da senha" className="input" />
      <input type="text" name="cid" placeholder="CID" className="input" />
    </>
  );
}
