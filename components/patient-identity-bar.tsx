/**
 * Header de identificação rápida do paciente — PRD "11 incrementos" item 1.
 * Fica sempre visível no topo da ficha: nome, convênio ativo + carteirinha,
 * contato de emergência. Puramente de leitura — cadastro continua nos
 * formulários de convênio/responsáveis já existentes.
 */
export function PatientIdentityBar({
  patientName,
  insurance,
  emergencyContact,
}: {
  patientName: string;
  insurance: { insurerName: string; cardNumber: string | null } | null;
  emergencyContact: { name: string; phone: string } | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-paper-line-strong bg-paper px-6 py-4 sm:px-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Paciente</p>
        <p className="text-base font-semibold text-ink">{patientName}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Convênio</p>
        {insurance ? (
          <p className="text-sm text-ink">
            {insurance.insurerName}
            {insurance.cardNumber && (
              <span className="text-ink-soft"> · carteirinha {insurance.cardNumber}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Particular</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Contato de emergência
        </p>
        {emergencyContact ? (
          <a
            href={`tel:${emergencyContact.phone}`}
            className="text-sm text-ink underline decoration-paper-line-strong underline-offset-2 hover:text-chart"
          >
            {emergencyContact.name} · {emergencyContact.phone}
          </a>
        ) : (
          <p className="text-sm text-status-negative-text">Não cadastrado</p>
        )}
      </div>
    </div>
  );
}
