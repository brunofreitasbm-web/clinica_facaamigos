import Link from "next/link";

interface AuditoriaSubnavProps {
  activeTab: "lgpd" | "ouvidoria";
}

const ITEMS = [
  { key: "lgpd", label: "Acesso a Prontuários (LGPD)", href: "/gestor/auditoria" },
  { key: "ouvidoria", label: "Ouvidoria & Incidentes", href: "/gestor/ouvidoria" },
] as const;

export function AuditoriaSubnav({ activeTab }: AuditoriaSubnavProps) {
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
