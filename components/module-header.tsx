"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, type LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";

/**
 * Cabeçalho ÚNICO dos módulos (Recepção, Gestão, Faturamento, Coordenação).
 *
 * Antes cada módulo tinha o seu: components/recepcao-nav.tsx,
 * components/gestor-nav.tsx, app/faturamento/faturamento-header.tsx e o
 * <header> de dentro de app/supervisao/supervisao-shell.tsx. Quatro cópias
 * que divergiram em tudo o que não é a lista de itens — fundo (Gestão usava
 * `--color-accent-600`, os outros `--color-accent`), resolução do item ativo
 * (quatro algoritmos), estilo do badge, `print:hidden` e o fallback pra tela
 * estreita (só a Recepção tinha). O que muda de módulo pra módulo é a lista
 * de `items`; o resto é isto aqui.
 *
 * A barra é `sticky top-0`: em telas longas (grade da Coordenação, listas de
 * glosas) o cabeçalho sumia ao rolar em três dos quatro módulos.
 *
 * É montado pelo `layout.tsx` do módulo, nunca por dentro de um `page.tsx` —
 * senão desmonta e remonta a cada navegação e o item ativo pisca.
 */

/** Item que navega. `match` são prefixos de rota extras (abas que moram fora do próprio prefixo). */
export type ModuleNavLink = {
  key: string;
  label: string;
  href: string;
  /** Prefixos de SEGMENTO que marcam este item como ativo. Default: `[href]`. */
  match?: readonly string[];
  icon?: LucideIcon;
  /** Contagem no pill branco. 0 ou undefined = sem pill. */
  badge?: number;
  /** Badge assíncrono (server component sob <Suspense>) — alternativa a `badge`. */
  badgeSlot?: React.ReactNode;
  /** Item que leva pra fora do módulo: ganha o ícone de saída. */
  external?: boolean;
};

/** Item que troca de aba em memória, sem navegar (Coordenação). */
export type ModuleNavTab = {
  key: string;
  label: string;
  onSelect: () => void;
  selected: boolean;
  icon?: LucideIcon;
  badge?: number;
  href?: never;
};

export type ModuleNavItem = ModuleNavLink | ModuleNavTab;

function isTab(item: ModuleNavItem): item is ModuleNavTab {
  return "onSelect" in item;
}

/** Prefixo de SEGMENTO — impede que "/gestor/cadastros-antigo" case com "/gestor/cadastros". */
function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

/**
 * Item ativo pelo pathname, com o match MAIS LONGO vencendo — é o que faz
 * "/recepcao/pacientes/pendencias" marcar Pendências e não Pacientes, e
 * "/recepcao/qualquer-coisa" não marcar a Agenda (href "/recepcao").
 * Rota não mapeada devolve `null`: a barra prefere não marcar nada a marcar
 * o item errado.
 */
function resolveActive(pathname: string | null, items: readonly ModuleNavItem[], noActiveOn: readonly string[]) {
  if (!pathname) return null;
  if (noActiveOn.some((base) => isUnder(pathname, base))) return null;

  let best: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    if (isTab(item)) continue;
    for (const base of item.match ?? [item.href]) {
      if (isUnder(pathname, base) && base.length > bestLen) {
        best = item.key;
        bestLen = base.length;
      }
    }
  }
  return best;
}

function Badge({ value }: { value: number }) {
  return (
    <span
      className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-xs"
      style={{ background: "#FFFFFF", color: "#0F172A" }}
    >
      {value}
    </span>
  );
}

export function ModuleHeader({
  module,
  homeHref,
  items,
  navLabel,
  noActiveOn = [],
  actions,
}: {
  /** Sufixo da marca: "· Recepção". */
  module: string;
  /** Destino do lockup. Omitido = lockup sem link (Coordenação, que não tem home própria). */
  homeHref?: string;
  items: readonly ModuleNavItem[];
  /** `aria-label` da nav, ex.: "Seções da recepção". */
  navLabel: string;
  /** Rotas do módulo que não correspondem a nenhum item (ex.: "/gestor" e "/gestor/maturidade"). */
  noActiveOn?: readonly string[];
  /** Canto direito: avatar, atalhos. */
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = resolveActive(pathname, items, noActiveOn);

  const isCurrentOf = (item: ModuleNavItem) => (isTab(item) ? item.selected : active === item.key);

  const itemStyle = (isCurrent: boolean) => ({
    color: isCurrent ? "var(--color-on-accent)" : "var(--color-on-accent-soft)",
    background: isCurrent ? "color-mix(in srgb, var(--color-on-accent) 14%, transparent)" : "transparent",
    borderBottom: isCurrent ? "3px solid var(--color-on-accent)" : "3px solid transparent",
    opacity: isCurrent ? 1 : 0.85,
  });

  const itemClass =
    "flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[13px] font-semibold no-underline transition-all duration-150 active:scale-95 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div className="sticky top-0 z-20 shrink-0 print:hidden">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-6 px-6 shadow-sm sm:px-10"
      >
        <BrandLockup module={module} href={homeHref} className="mr-auto" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label={navLabel}>
          {items.map((item) => {
            const Icon = item.icon;
            const isCurrent = isCurrentOf(item);
            const content = (
              <>
                {Icon && <Icon size={15} aria-hidden />}
                {item.label}
                {!isTab(item) && item.external && <ExternalLink size={11} aria-label={`(sai do módulo ${module})`} />}
                {item.badge ? <Badge value={item.badge} /> : null}
                {!isTab(item) && item.badgeSlot}
              </>
            );

            return isTab(item) ? (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                aria-pressed={isCurrent}
                className={itemClass}
                style={itemStyle(isCurrent)}
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                prefetch={true}
                aria-current={isCurrent ? "page" : undefined}
                className={itemClass}
                style={itemStyle(isCurrent)}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {actions}
      </header>

      {/* Navegação compacta pra telas estreitas (a barra do topo esconde os itens) */}
      <nav
        className="flex w-full flex-wrap gap-1 border-b px-6 py-2 lg:hidden"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-200)" }}
        aria-label={navLabel}
      >
        {items.map((item) => {
          const isCurrent = isCurrentOf(item);
          const style = {
            background: isCurrent ? "var(--color-accent)" : "var(--color-neutral-100)",
            color: isCurrent ? "#fff" : "var(--color-ink)",
          };
          const cls = "rounded-full px-2.5 py-1 text-xs font-semibold no-underline";

          return isTab(item) ? (
            <button key={item.key} type="button" onClick={item.onSelect} aria-pressed={isCurrent} className={cls} style={style}>
              {item.label}
            </button>
          ) : (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className={cls}
              style={style}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
