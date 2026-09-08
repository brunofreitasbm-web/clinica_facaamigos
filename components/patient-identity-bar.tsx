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
  variant = "bar",
}: {
  patientName: string;
  insurance: { insurerName: string; cardNumber: string | null } | null;
  emergencyContact: { name: string; phone: string } | null;
  variant?: "bar" | "sidebar";
}) {
  if (variant === "sidebar") {
    const initials = patientName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-paper-line-strong bg-paper p-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-paper-line pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-1 text-base font-bold text-accent-1-text shadow-inner">
            {initials || "P"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Paciente</p>
            <h2 className="truncate text-base font-bold text-ink" title={patientName}>
              {patientName}
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Convênio / Plano</p>
            {insurance ? (
              <p className="font-medium text-ink">
                {insurance.insurerName}
                {insurance.cardNumber && (
                  <span className="block text-xs text-ink-soft">Cartão: {insurance.cardNumber}</span>
                )}
              </p>
            ) : (
              <span className="inline-flex rounded-full bg-paper-surface px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                Particular
              </span>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Contato de Emergência
            </p>
            {emergencyContact ? (
              <a
                href={`tel:${emergencyContact.phone}`}
                className="group flex items-center gap-1.5 font-medium text-ink hover:text-chart"
              >
                <span>📞</span>
                <span className="underline underline-offset-2">{emergencyContact.name}</span>
                <span className="text-xs text-ink-soft">({emergencyContact.phone})</span>
              </a>
            ) : (
              <p className="text-xs font-medium text-status-negative-text">⚠️ Não cadastrado</p>
            )}
          </div>
        </div>
      </div>
    );
  }

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
