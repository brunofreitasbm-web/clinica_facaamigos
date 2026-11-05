import type { ExpiringPatientGroup } from "@/lib/expiring-guides-pure";

export type ExpiringGuideRow = ExpiringPatientGroup & {
  /** wa.me com o pedido de renovação pronto; null quando não há telefone do responsável. */
  renewUrl: string | null;
};

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Card "Guias vencendo ou acabando": uma linha por paciente, guias (com validade) embaixo. */
export function ExpiringGuidesCard({ rows }: { rows: ExpiringGuideRow[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
      <h6 className="mb-3.5 text-xs font-bold uppercase tracking-wide text-slate-700">Guias vencendo ou acabando</h6>
      <div className="flex flex-col gap-3.5">
        {rows.length === 0 && (
          <p className="text-xs text-slate-500 italic">Nenhuma guia vencendo em 15 dias nem com poucas sessões restantes.</p>
        )}
        {rows.map((row) => (
          <div key={row.patientId} className="flex flex-col gap-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{row.patientName}</div>
                <div className="text-[11px] text-slate-600">{row.insurerName}</div>
              </div>
              <span className="whitespace-nowrap rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {row.reason === "vencendo"
                  ? `vence ${fmtDate(row.nextValidTo)}`
                  : `${row.lowestBalance ?? 0} ${row.lowestBalance === 1 ? "sessão" : "sessões"} restantes`}
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {row.guides.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3 text-[11px] text-slate-600">
                  <span>
                    {g.guideNumber ? `Guia ${g.guideNumber}` : g.procedureCode} · {g.sessionsUsed} de {g.sessionsAuthorized} sessões
                  </span>
                  <span className={g.reason === "vencendo" ? "whitespace-nowrap font-semibold text-amber-700" : "whitespace-nowrap"}>
                    válida até {fmtDate(g.validTo)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              {row.renewUrl ? (
                <a
                  href={row.renewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary no-underline"
                  title="Abre o WhatsApp com o pedido de renovação pronto para o responsável"
                >
                  Renovar guia
                </a>
              ) : (
                <span className="text-[11px] italic text-slate-500">Sem telefone do responsável — avise manualmente</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
