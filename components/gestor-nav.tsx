"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Cabeçalho navy do módulo Gestão — layout Broadsheet/Instituto Faça Amigos.
 * Reproduz a barra Painel/Cadastros/Financeiro (Dashboard.dc.html,
 * Cadastros.dc.html, Financeiro.dc.html); o item ativo ganha sublinhado
 * dourado (--color-accent-2). "Painel executivo" (Gestor.dc.html) não é um
 * item desta barra — é alcançado por um link dedicado a partir do Painel
 * (ver app/gestor/dashboard/page.tsx), por isso `active` aceita `null` para
 * essa tela sem marcar nenhum item como corrente.
 */
const NAV_ITEMS = [
  { key: "painel", label: "Painel", href: "/gestor/dashboard" },
  { key: "inteligencia", label: "Inteligência BI", href: "/gestor/inteligencia" },
  { key: "cadastros", label: "Cadastros", href: "/gestor/cadastros" },
  { key: "financeiro", label: "Financeiro", href: "/gestor/financeiro" },
  { key: "bonificacao", label: "PLR & Faixas", href: "/gestor/bonificacao" },
  { key: "metas", label: "Metas por Cargo", href: "/gestor/metas" },
  { key: "auditoria", label: "Auditoria (LGPD)", href: "/gestor/auditoria" },
  { key: "configuracoes", label: "Configurações", href: "/gestor/configuracoes" },
] as const;

export type GestorNavKey = (typeof NAV_ITEMS)[number]["key"];

export function GestorNav({ active = null }: { active?: GestorNavKey | null }) {
  const pathname = usePathname();

  return (
    <header
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10 shadow-sm"
    >
      <Link href="/gestor" prefetch={true} className="mr-auto flex items-center gap-3 no-underline transition-opacity hover:opacity-90">
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
            · Gestão
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-8">
        {NAV_ITEMS.map((item) => {
          const isCurrent = active ? active === item.key : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={true}
              aria-current={isCurrent ? "page" : undefined}
              className="pb-1 text-[13px] no-underline font-semibold transition-all duration-150 active:scale-95 hover:opacity-100"
              style={{
                color: isCurrent ? "var(--color-on-accent)" : "var(--color-on-accent-soft)",
                borderBottom: isCurrent ? "2px solid var(--color-on-accent)" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

