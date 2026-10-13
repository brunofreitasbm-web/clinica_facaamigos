import { HealthPlanBadge } from "@/components/health-plan-badge";

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
  insurance: { insurerName: string; cardNumber: string | null; badgeColor?: string | null } | null;
  emergencyContact: { name: string; phone: string } | null;
  variant?: "bar" | "sidebar";
}) {
  const planName = insurance?.insurerName ?? "Particular";
  const planColor = insurance?.badgeColor;

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
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-ink" title={patientName}>
                {patientName}
              </h2>
              <HealthPlanBadge name={planName} color={planColor} size="sm" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Plano de Saúde</p>
            <div className="mt-1 flex items-center gap-2">
              <HealthPlanBadge name={planName} color={planColor} size="md" />
              {insurance?.cardNumber && (
                <span className="text-xs text-ink-soft">Cartão: {insurance.cardNumber}</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Contato de Emergência
            </p>
            {emergencyContact ? (
              <a
                href={`tel:${emergencyContact.phone}`}
                className="group flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all duration-150 active:scale-95 hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span aria-hidden>📞</span>
                <span className="truncate">{emergencyContact.name}</span>
                <span className="text-[11px] font-normal text-ink-soft">({emergencyContact.phone})</span>
              </a>
            ) : (
              <p className="flex min-h-[44px] items-center text-xs font-medium text-status-negative-text">⚠️ Não cadastrado</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-paper-line-strong bg-paper px-6 py-3 sm:px-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Paciente</p>
        <div className="flex items-center gap-2.5">
          <p className="text-base font-semibold text-ink">{patientName}</p>
          <HealthPlanBadge name={planName} color={planColor} size="sm" />
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Plano de Saúde</p>
        <div className="mt-0.5 flex items-center gap-2">
          <HealthPlanBadge name={planName} color={planColor} size="sm" />
          {insurance?.cardNumber && (
            <span className="text-xs text-ink-soft">carteirinha {insurance.cardNumber}</span>
          )}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Contato de emergência
        </p>
        {emergencyContact ? (
          <a
            href={`tel:${emergencyContact.phone}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink underline decoration-paper-line-strong underline-offset-2 transition-colors hover:text-chart active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span>📞</span> {emergencyContact.name} · {emergencyContact.phone}
          </a>
        ) : (
          <p className="inline-flex min-h-[44px] items-center text-sm font-medium text-status-negative-text">⚠️ Não cadastrado</p>
        )}
      </div>
    </div>
  );
}
