import Link from "next/link";

interface FinanceiroSubnavProps {
  activeTab: "repasses" | "contratos" | "contas-a-pagar" | "dre";
}

const ITEMS = [
  { key: "repasses", label: "Repasses & Glosas", href: "/gestor/financeiro" },
  { key: "contratos", label: "Contratos Particulares", href: "/gestor/contratos" },
  { key: "contas-a-pagar", label: "Contas a Pagar", href: "/gestor/financeiro/contas-a-pagar" },
  { key: "dre", label: "DRE & Fluxo de Caixa", href: "/gestor/financeiro/dre" },
] as const;

export function FinanceiroSubnav({ activeTab }: FinanceiroSubnavProps) {
  return (
    <div
      role="navigation"
      aria-label="Subseções do Financeiro"
      className="flex flex-wrap border-b border-paper-line-strong px-6 sm:px-10 gap-2 sm:gap-6 bg-paper/30"
    >
      {ITEMS.map((item) => {
        const isCurrent = activeTab === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center px-2 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-150 active:scale-95 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              isCurrent
                ? "border-accent text-accent"
                : "border-transparent text-ink-faint hover:text-ink-strong hover:border-neutral-300"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
