"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionSidebarItem = {
  key: string;
  label: string;
  href: string;
  /** Sai da seção (ex.: "Terapeutas" leva pra /gestor/equipe). Ganha marca visual. */
  external?: boolean;
};

/**
 * Sidebar de navegação lateral compartilhada por /gestor/cadastros e
 * /gestor/configuracoes — mesmo visual, listas de itens diferentes. Extraída
 * porque as duas seções eram cópias quase idênticas (ver
 * app/gestor/cadastros/cadastros-sidebar.tsx e
 * app/gestor/configuracoes/config-sidebar.tsx).
 *
 * Vive nos layout.tsx das duas seções (10/09/2026). Antes era renderizada por
 * dentro de cada page.tsx/manager, com o item ativo passado na mão: a coluna
 * inteira desmontava e remontava a cada clique, e sumia durante os loadings
 * (nenhum loading.tsx a renderizava). O item ativo agora sai do pathname —
 * assim ele também fica correto em telas que não passavam prop nenhuma.
 */
function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

export function SectionSidebar({
  title,
  items,
}: {
  title: string;
  items: readonly SectionSidebarItem[];
}) {
  const pathname = usePathname();

  // Match mais longo vence — os itens de uma seção compartilham prefixo.
  let activeKey: string | null = null;
  let bestLen = 0;
  for (const item of items) {
    if (item.external) continue;
    if (pathname && isUnder(pathname, item.href) && item.href.length > bestLen) {
      activeKey = item.key;
      bestLen = item.href.length;
    }
  }

  return (
    <aside className="w-[220px] shrink-0 border-r border-paper-line-strong px-4 py-8">
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3 px-3">
        {title}
      </h6>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={true}
            aria-current={activeKey === item.key ? "page" : undefined}
            className="rounded-md px-3 py-2 text-[14px] no-underline"
            style={{
              color: activeKey === item.key ? "var(--color-accent)" : "var(--color-text)",
              background: activeKey === item.key ? "var(--color-accent-100)" : "transparent",
              fontWeight: activeKey === item.key ? 600 : 400,
            }}
          >
            {item.label}
            {item.external && <span aria-label="(sai desta seção)"> ↗</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
