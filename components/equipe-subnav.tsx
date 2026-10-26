import Link from "next/link";

interface EquipeSubnavProps {
  activeTab: "bonificacao" | "bonificacao-config" | "metas" | "faixas";
}

const ITEMS = [
  { key: "bonificacao", label: "PLR & Desempenho", href: "/gestor/bonificacao" },
  { key: "bonificacao-config", label: "Configurar & Simular", href: "/gestor/bonificacao/config" },
  { key: "metas", label: "Metas por Cargo", href: "/gestor/metas" },
  { key: "faixas", label: "Contratos & Valor-hora", href: "/gestor/configuracoes/profissionais" },
] as const;

export function EquipeSubnav({ activeTab }: EquipeSubnavProps) {
  return (
    <div
      role="navigation"
      aria-label="Subseções de Equipe & Desempenho"
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
