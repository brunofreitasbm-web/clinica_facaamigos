import Link from "next/link";
import { PayoutStatementModal } from "@/components/payout-statement";

export default function TerapeutaRepassePage() {
  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <Link href="/terapeuta" className="hover:underline">
                Área do Terapeuta
              </Link>
              <span>/</span>
              <span className="text-ink">Extrato de Repasse</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-ink">
              Extrato de Repasse Mensal (PJ)
            </h1>
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

        {/* Resumo Atual */}
        <div className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-paper-line pb-4">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                Faixa Atual Contratada
              </span>
              <h2 className="text-xl font-bold text-ink">
                Faixa 2 · Especialista Sênior
              </h2>
              <p className="text-xs text-ink-soft">
                Valor-Hora por Sessão Realizada: <span className="font-semibold text-ink">R$ 90,00</span>
              </p>
            </div>
            <PayoutStatementModal />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
              <span className="text-xs font-medium text-ink-soft uppercase">
                Sessões Realizadas (Agosto/26)
              </span>
              <p className="mt-2 text-3xl font-bold text-ink">42</p>
            </div>

            <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
              <span className="text-xs font-medium text-ink-soft uppercase">
                Assiduidade no Período
              </span>
              <p className="mt-2 text-3xl font-bold text-emerald-600">100%</p>
              <span className="text-xs text-ink-faint">0 cancelamentos sem justificativa</span>
            </div>

            <div className="rounded-lg border border-paper-line bg-paper-subtle p-4">
              <span className="text-xs font-medium text-ink-soft uppercase">
                Repasse Total a Receber
              </span>
              <p className="mt-2 text-3xl font-bold text-accent">R$ 3.780,00</p>
            </div>
          </div>
        </div>

        {/* Histórico de Competências */}
        <div className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-ink">
            Histórico de Competências Fechadas
          </h3>

          <div className="divide-y divide-paper-line border-t border-paper-line">
            <div className="flex items-center justify-between py-3.5 text-sm">
              <div>
                <p className="font-semibold text-ink">Agosto / 2026</p>
                <p className="text-xs text-ink-soft">42 sessões · R$ 90,00/h</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Aprovado
                </span>
                <PayoutStatementModal />
              </div>
            </div>

            <div className="flex items-center justify-between py-3.5 text-sm">
              <div>
                <p className="font-semibold text-ink">Julho / 2026</p>
                <p className="text-xs text-ink-soft">38 sessões · R$ 90,00/h</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Pago
                </span>
                <PayoutStatementModal />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
