import Link from "next/link";

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
  { key: "cadastros", label: "Cadastros", href: "/gestor/cadastros" },
  { key: "financeiro", label: "Financeiro", href: "/gestor/financeiro" },
  { key: "bonificacao", label: "PLR & Faixas", href: "/gestor/bonificacao" },
] as const;

export type GestorNavKey = (typeof NAV_ITEMS)[number]["key"];

export function GestorNav({ active = null }: { active?: GestorNavKey | null }) {
  return (
    <header
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10"
    >
      <Link href="/gestor" className="mr-auto flex items-center gap-3 no-underline">
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
          <span style={{ color: "var(--color-accent-2)" }} className="font-normal italic">
            · Gestão
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-8">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className="pb-1 text-[13px] no-underline"
            style={{
              color: "inherit",
              opacity: active === item.key ? 1 : 0.75,
              borderBottom:
                active === item.key ? "2px solid var(--color-accent-2)" : "2px solid transparent",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
