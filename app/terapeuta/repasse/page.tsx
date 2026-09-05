import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayoutStatementModal } from "@/components/payout-statement";
import { getMyContract, getMyPayoutHistory, getMyPayoutStatement } from "./data";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  Pago: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "A pagar": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "Sem sessões": "bg-paper-subtle text-ink-faint",
};

export default async function TerapeutaRepassePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, council_type, council_number")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "terapeuta") redirect("/");

  const contract = await getMyContract(supabase, profile.id);
  const history = await getMyPayoutHistory(supabase, profile.id, contract);
  const [current, ...past] = history;

  const councilLabel = profile.council_type && profile.council_number ? `${profile.council_type} ${profile.council_number}` : null;

  const currentStatement = current
    ? await getMyPayoutStatement(supabase, profile.id, profile.full_name, councilLabel, contract, current)
    : null;
  const pastStatements = await Promise.all(
    past.map((row) => getMyPayoutStatement(supabase, profile.id, profile.full_name, councilLabel, contract, row)),
  );

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Link href="/terapeuta" className="hover:underline">
                Área do Terapeuta
              </Link>
              <span>/</span>
              <span className="text-ink">Extrato de Repasse</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-ink">Extrato de Repasse Mensal (PJ)</h1>
            <p className="text-sm text-ink-soft">
              Consulte seus extratos de atendimentos realizados e faixa de valor-hora contratual.
            </p>
          </div>
          <Link
            href="/terapeuta"
            className="rounded-md border border-paper-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-subtle"
          >
            Voltar para Agenda
          </Link>
        </div>

        <div className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-paper-line pb-4">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">Faixa Atual Contratada</span>
              <h2 className="text-xl font-bold text-ink">{contract?.tier ?? "Sem contrato vigente"}</h2>
              <p className="text-xs text-ink-soft">
                Valor-Hora por Sessão Realizada:{" "}
                <span className="font-semibold text-ink">{contract ? currency.format(contract.hourlyRate) : "—"}</span>
              </p>
            </div>
            {currentStatement && <PayoutStatementModal data={currentStatement} />}
          </div>

          {current ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
                <span className="text-xs font-medium text-ink-soft uppercase">
                  Sessões Realizadas ({current.competenceLabel})
                </span>
                <p className="mt-2 text-3xl font-bold text-ink">{current.sessionsCount}</p>
              </div>

              <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
                <span className="text-xs font-medium text-ink-soft uppercase">Status do período</span>
                <p className="mt-2 text-lg font-bold text-ink">
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_BADGE[current.statusLabel]}`}>
                    {current.statusLabel}
                  </span>
                </p>
                {current.isLive && <span className="text-xs text-ink-faint">calculado ao vivo · competência ainda aberta</span>}
              </div>

              <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
                <span className="text-xs font-medium text-ink-soft uppercase">Repasse Total a Receber</span>
                <p className="mt-2 text-3xl font-bold text-accent">{currency.format(current.netAmount)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Nenhum dado de repasse encontrado.</p>
          )}
        </div>

        <div className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-ink">Histórico de Competências Fechadas</h3>

          <div className="divide-y divide-paper-line border-t border-paper-line">
            {past.map((row, i) => (
              <div key={row.competenceMonth} className="flex items-center justify-between py-3.5 text-sm">
                <div>
                  <p className="font-semibold text-ink">{row.competenceLabel}</p>
                  <p className="text-xs text-ink-soft">
                    {row.sessionsCount} sessões {contract ? `· ${currency.format(contract.hourlyRate)}/h` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.statusLabel]}`}>
                    {row.statusLabel}
                  </span>
                  <PayoutStatementModal data={pastStatements[i]} />
                </div>
              </div>
            ))}
            {past.length === 0 && <p className="py-3.5 text-sm text-ink-faint">Nenhuma competência fechada ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
