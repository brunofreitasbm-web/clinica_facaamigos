import { FaturamentoHeader } from "../faturamento-header";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getPendingGuias } from "./data";
import { GuiasClient } from "./guias-client";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function GuiasTissPage() {
  const supabase = await createClient();
  const groups = await getPendingGuias(supabase, DEV_CLINIC_ID);

  const totalGuias = groups.reduce((acc, g) => acc + g.guias.length, 0);
  const totalValor = groups.reduce((acc, g) => acc + g.guias.reduce((s, x) => s + x.valorTotal, 0), 0);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <FaturamentoHeader active="guias" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-paper-line pb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
              Faturamento TISS (Guias & Lotes XML)
            </h1>
            <p className="text-sm text-ink-soft">
              Geração de lote XML SP-SADT (padrão ANS 3.05.00) a partir das competências fechadas e ainda não enviadas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Guias pendentes</span>
            <div className="text-2xl font-semibold text-chart tabular-nums mt-1 font-mono">{totalGuias}</div>
          </div>
          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Valor total pendente</span>
            <div className="text-2xl font-semibold text-status-positive tabular-nums mt-1 font-mono">{currency.format(totalValor)}</div>
          </div>
          <div className="rounded-lg border border-paper-line bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Competências pendentes</span>
            <div className="text-2xl font-semibold text-gold tabular-nums mt-1 font-mono">{groups.length}</div>
          </div>
        </div>

        <GuiasClient groups={groups} />
      </main>
    </div>
  );
}
