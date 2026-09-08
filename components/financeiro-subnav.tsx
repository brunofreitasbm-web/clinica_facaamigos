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
    <div className="flex border-b border-paper-line-strong px-6 sm:px-10 pt-4 gap-6 bg-paper/30">
      {ITEMS.map((item) => {
        const isCurrent = activeTab === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all no-underline ${
              isCurrent
                ? "border-accent text-accent"
                : "border-transparent text-ink-faint hover:text-ink-strong"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
