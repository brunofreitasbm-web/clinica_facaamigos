"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Smile } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Cabeçalho navy do módulo Gestão — layout Broadsheet/FaçaAmigos.
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
  { key: "atendimento", label: "Central de Atendimento", href: "/recepcao/atendimento", icon: MessageCircle },
  { key: "nps", label: "NPS", href: "/gestor/nps", icon: Smile },
  { key: "equipe", label: "Equipe", href: "/gestor/equipe" },
  { key: "cadastros", label: "Cadastros", href: "/gestor/cadastros" },
  { key: "financeiro", label: "Financeiro", href: "/gestor/financeiro" },
  { key: "auditoria", label: "Auditoria (LGPD)", href: "/gestor/auditoria" },
  { key: "configuracoes", label: "Configurações", href: "/gestor/configuracoes" },
] as const;

export type GestorNavKey = (typeof NAV_ITEMS)[number]["key"];

export function GestorNav({
  active = null,
  pendingNpsAlerts = 0,
}: {
  active?: GestorNavKey | null;
  pendingNpsAlerts?: number;
}) {
  const pathname = usePathname();

  return (
    <header
      style={{ background: "var(--color-accent-600)", color: "var(--color-bg)" }}
      className="flex h-16 items-center gap-8 px-10 shadow-sm"
    >
      <Link
        href="/gestor"
        prefetch={true}
        className="mr-auto flex items-center gap-3 rounded no-underline transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Logo variant="simbolo" tone="branco" height={30} decorative />
        <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
          FaçaAmigos{" "}
          <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
            · Gestão
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isCurrent = active ? active === item.key : pathname?.startsWith(item.href);
          const Icon = "icon" in item ? item.icon : null;
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={true}
              aria-current={isCurrent ? "page" : undefined}
              className="relative flex items-center gap-1.5 rounded-t px-1 pb-1.5 text-[13px] no-underline font-semibold transition-all duration-150 active:scale-95 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                color: isCurrent ? "var(--color-on-accent)" : "var(--color-on-accent-soft)",
                background: isCurrent ? "color-mix(in srgb, var(--color-on-accent) 14%, transparent)" : "transparent",
                borderBottom: isCurrent ? "3px solid var(--color-on-accent)" : "3px solid transparent",
              }}
            >
              {Icon && <Icon size={14} />}
              {item.label}
              {item.key === "nps" && pendingNpsAlerts > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{ background: "var(--color-status-negative, #d92d20)", color: "#fff" }}
                >
                  {pendingNpsAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

