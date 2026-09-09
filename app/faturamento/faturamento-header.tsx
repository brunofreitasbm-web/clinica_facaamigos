"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/brand/brand-lockup";

const NAV_ITEMS = [
  { key: "competencia", label: "Competência", href: "/faturamento" },
  { key: "guias", label: "Guias TISS", href: "/faturamento/guias" },
  { key: "glosas", label: "Glosas", href: "/faturamento/glosas" },
  { key: "repasses", label: "Repasses", href: "/faturamento/repasses" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

/**
 * Cabeçalho navy da área de faturamento — layout Broadsheet/FaçaAmigos
 */
export function FaturamentoHeader({ active }: { active?: NavKey }) {
  const pathname = usePathname();

  return (
    <header
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10 shadow-sm"
    >
      <BrandLockup module="Faturamento" href="/faturamento" className="mr-auto" />
      <nav className="flex items-center gap-6 text-[15px] font-semibold">
        {NAV_ITEMS.map((item) => {
          const isCurrent = active
            ? active === item.key
            : pathname === item.href || (item.href !== "/faturamento" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className="relative py-5 no-underline transition-all duration-150 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={
                isCurrent
                  ? {
                      color: "var(--color-on-accent)",
                      borderBottom: "3px solid var(--color-on-accent)",
                      fontWeight: 600,
                      opacity: 1,
                    }
                  : { color: "var(--color-on-accent-soft)", opacity: 0.85 }
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
