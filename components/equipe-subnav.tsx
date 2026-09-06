import Link from "next/link";

interface EquipeSubnavProps {
  activeTab: "colaboradores" | "bonificacao" | "metas" | "faixas";
}

const ITEMS = [
  { key: "colaboradores", label: "Colaboradores & Contas", href: "/gestor/equipe" },
  { key: "bonificacao", label: "PLR & Desempenho", href: "/gestor/bonificacao" },
  { key: "metas", label: "Metas por Cargo", href: "/gestor/metas" },
  { key: "faixas", label: "Tabela Salarial / Faixas", href: "/gestor/configuracoes/profissionais" },
] as const;

export function EquipeSubnav({ activeTab }: EquipeSubnavProps) {
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
