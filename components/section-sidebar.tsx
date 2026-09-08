import Link from "next/link";

export type SectionSidebarItem<K extends string> = {
  key: K;
  label: string;
  href: string;
};

/**
 * Sidebar de navegação lateral compartilhada por /gestor/cadastros e
 * /gestor/configuracoes — mesmo visual, listas de itens diferentes. Extraída
 * porque as duas seções eram cópias quase idênticas (ver
 * app/gestor/cadastros/cadastros-sidebar.tsx e
 * app/gestor/configuracoes/config-sidebar.tsx).
 */
export function SectionSidebar<K extends string>({
  title,
  items,
  active,
}: {
  title: string;
  items: readonly SectionSidebarItem<K>[];
  active: K;
}) {
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
            aria-current={active === item.key ? "page" : undefined}
            className="rounded-md px-3 py-2 text-[14px] no-underline"
            style={{
              color: active === item.key ? "var(--color-accent)" : "var(--color-text)",
              background: active === item.key ? "var(--color-accent-100)" : "transparent",
              fontWeight: active === item.key ? 600 : 400,
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
