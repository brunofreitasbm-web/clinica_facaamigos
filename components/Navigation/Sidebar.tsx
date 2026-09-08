"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  Receipt, 
  AlertCircle, 
  DollarSign, 
  Layers, 
  LucideIcon 
} from "lucide-react";

export interface SidebarNavItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: number | string;
}

const DEFAULT_FATURAMENTO_NAV: SidebarNavItem[] = [
  { key: "competencia", label: "Competência", href: "/faturamento", icon: Layers },
  { key: "guias", label: "Guias TISS", href: "/faturamento/guias", icon: FileText },
  { key: "glosas", label: "Glosas", href: "/faturamento/glosas", icon: AlertCircle },
  { key: "repasses", label: "Repasses", href: "/faturamento/repasses", icon: DollarSign },
];

export interface SidebarProps {
  items?: SidebarNavItem[];
  title?: string;
  className?: string;
}

export function Sidebar({
  items = DEFAULT_FATURAMENTO_NAV,
  title = "Faturamento & Gestão",
  className = "",
}: SidebarProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/faturamento" || href === "/gestor") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={`w-64 shrink-0 border-r border-paper-line-strong bg-white p-4 shadow-sm ${className}`}
      aria-label={title}
    >
      {title && (
        <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          {title}
        </h2>
      )}

      <nav className="flex flex-col gap-1.5" aria-label="Navegação Principal">
        {items.map((item) => {
          const active = isLinkActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "active-link border-l-4 border-[#E91E63] bg-[#FCE4EC] font-semibold text-[#E91E63] shadow-xs"
                  : "border-l-4 border-transparent text-ink-soft hover:bg-paper hover:text-ink"
              }`}
              style={
                active
                  ? {
                      backgroundColor: "#FCE4EC",
                      borderLeft: "4px solid #E91E63",
                      color: "#E91E63",
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2.5">
                {Icon && (
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active ? "text-[#E91E63]" : "text-ink-faint group-hover:text-ink"
                    }`}
                  />
                )}
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    active
                      ? "bg-chart text-white"
                      : "bg-paper-line-strong text-ink-soft"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
