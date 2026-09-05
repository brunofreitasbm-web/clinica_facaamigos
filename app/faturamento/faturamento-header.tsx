import Link from "next/link";

const NAV_ITEMS = [
  { key: "competencia", label: "Competência", href: "/faturamento" },
  { key: "guias", label: "Guias TISS", href: "/faturamento/guias" },
  { key: "glosas", label: "Glosas", href: "/faturamento/glosas" },
  { key: "repasses", label: "Repasses", href: "/faturamento/repasses" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

/**
 * Cabeçalho navy da área de faturamento — layout Broadsheet/Instituto Faça Amigos
 */
export function FaturamentoHeader({ active = "competencia" }: { active?: NavKey }) {
  return (
    <header
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10"
    >
      <Link href="/faturamento" className="mr-auto flex items-center gap-3 no-underline">
        <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
          <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
          <path
            d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
            fill="var(--color-accent-2)"
          />
          <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
        </svg>
        <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
          Faça Amigos{" "}
          <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
            · Faturamento
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-6 text-[15px] font-semibold">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="py-5 no-underline transition-opacity hover:opacity-100"
            style={
              item.key === active
                ? { color: "var(--color-on-accent)", borderBottom: "2px solid var(--color-on-accent)", opacity: 1 }
                : { color: "var(--color-on-accent-soft)", opacity: 1 }
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
