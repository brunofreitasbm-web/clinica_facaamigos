import Link from "next/link";

/**
 * Subnav do módulo financeiro HUB (/gestor/financeiro-hub) — separado do
 * FinanceiroSubnav (/gestor/financeiro) porque são módulos diferentes: um
 * cobre só a Clínica (repasses/glosas/contas a pagar), este consolida as
 * 3 unidades do grupo (Playground, Circuito, Clínica). De propósito NÃO
 * está linkado em nenhum outro menu (GestorNav etc.) — acesso só por quem
 * conhece a URL direta, e mesmo assim só quem é 'gestor' passa pelo
 * middleware (ver lib/roles.ts ROLE_ALLOWED_PREFIXES).
 */
interface FinanceiroHubSubnavProps {
  activeTab: "dre" | "balanco" | "fluxo-caixa" | "lancamentos";
  mes: string;
}

const ITEMS = [
  { key: "dre", label: "DRE Consolidado", path: "" },
  { key: "balanco", label: "Balanço Patrimonial", path: "/balanco" },
  { key: "fluxo-caixa", label: "Fluxo de Caixa", path: "/fluxo-caixa" },
  { key: "lancamentos", label: "Lançamentos Manuais", path: "/lancamentos" },
] as const;

export function FinanceiroHubSubnav({ activeTab, mes }: FinanceiroHubSubnavProps) {
  return (
    <div className="flex border-b border-paper-line-strong px-6 sm:px-10 pt-4 gap-6 bg-paper/30">
      {ITEMS.map((item) => {
        const isCurrent = activeTab === item.key;
        return (
          <Link
            key={item.key}
            href={`/gestor/financeiro-hub${item.path}?mes=${mes}`}
            aria-current={isCurrent ? "page" : undefined}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all no-underline ${
              isCurrent ? "border-accent text-accent" : "border-transparent text-ink-faint hover:text-ink-strong"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
