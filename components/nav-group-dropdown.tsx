"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type NavGroupLink = {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
};

/**
 * Dropdown categorizado pra barra do <ModuleHeader> — usado quando um módulo
 * tem itens de apoio demais pra caber lado a lado (achado real: a barra da
 * Coordenação tinha 11 abas/links espremidos, ver supervisao-header.tsx).
 * Fica no `actions` do ModuleHeader em vez de virar um `ModuleNavItem`, já
 * que esse tipo só representa link único ou aba — não agrupamento.
 */
export function NavGroupDropdown({ label, icon: Icon, links }: { label: string; icon?: LucideIcon; links: readonly NavGroupLink[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const hasActive = links.some((l) => pathname === l.href || pathname?.startsWith(l.href + "/"));

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[13px] font-semibold transition-all duration-150 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{
          color: hasActive ? "var(--color-on-accent)" : "var(--color-on-accent-soft)",
          background: hasActive ? "color-mix(in srgb, var(--color-on-accent) 14%, transparent)" : "transparent",
          opacity: hasActive ? 1 : 0.85,
        }}
      >
        {Icon && <Icon size={15} aria-hidden />}
        {label}
        <ChevronDown size={13} aria-hidden className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-50 mt-1 flex min-w-[220px] flex-col gap-0.5 rounded-lg border p-1.5 shadow-xl"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-200)" }}
        >
          {links.map((l) => {
            const LinkIcon = l.icon;
            const isCurrent = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.key}
                href={l.href}
                role="menuitem"
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-semibold no-underline transition-colors"
                style={{ color: "var(--color-ink)", background: isCurrent ? "var(--color-neutral-100)" : "transparent" }}
              >
                {LinkIcon && <LinkIcon size={14} aria-hidden />}
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
