"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  AlertCircle,
  MessageCircle,
  Inbox,
  FileText,
  Boxes,
  PhoneCall,
  Sparkles,
  UserX,
  DoorOpen,
} from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";

/**
 * Cabeçalho do módulo Recepção, renderizado pelo app/recepcao/layout.tsx
 * em TODAS as telas do módulo.
 */
const NAV_ITEMS = [
  { key: "agenda", label: "Agenda do dia", href: "/recepcao", icon: CalendarDays, exact: true },
  { key: "chegadas", label: "Chegadas", href: "/recepcao/chegadas", icon: DoorOpen, exact: false },
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users, exact: false },
  { key: "pendencias", label: "Pendências", href: "/recepcao/pacientes/pendencias", icon: AlertCircle, exact: false },
  { key: "atendimento", label: "Atendimento", href: "/recepcao/atendimento", icon: Inbox, exact: false },
  { key: "documentos", label: "Documentos", href: "/recepcao/documentos", icon: FileText, exact: false },
  { key: "precadastros", label: "Cadastro IA", href: "/recepcao/pre-cadastros", icon: Sparkles, exact: false },
  { key: "recursos", label: "Salas e recursos", href: "/recepcao/recursos", icon: Boxes, exact: false },
  { key: "emergencias", label: "Aviso Falta Terapeuta", href: "/recepcao/emergencias", icon: UserX, exact: false },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

function activeKey(pathname: string | null): NavKey | null {
  if (!pathname) return null;
  if (pathname === "/recepcao" || pathname.startsWith("/recepcao/agenda")) return "agenda";
  if (pathname.startsWith("/recepcao/chegadas")) return "chegadas";
  if (pathname.startsWith("/recepcao/pacientes/pendencias")) return "pendencias";
  if (pathname.startsWith("/recepcao/pacientes")) return "pacientes";
  if (pathname.startsWith("/recepcao/atendimento")) return "atendimento";
  if (pathname.startsWith("/recepcao/documentos")) return "documentos";
  if (pathname.startsWith("/recepcao/pre-cadastros")) return "precadastros";
  if (pathname.startsWith("/recepcao/recursos")) return "recursos";
  if (pathname.startsWith("/recepcao/emergencias")) return "emergencias";
  return null;
}

export function RecepcaoNav({
  pendingCount,
  tomorrowUnconfirmedCount,
  chegadasCount,
}: {
  pendingCount: number;
  tomorrowUnconfirmedCount?: number;
  /** Chegadas declaradas pelo QR ainda não confirmadas — ver app/recepcao/chegadas. */
  chegadasCount?: number;
}) {
  const pathname = usePathname();
  const current = activeKey(pathname);

  const badgeFor: Partial<Record<NavKey, number>> = {
    pendencias: pendingCount,
    chegadas: chegadasCount ?? 0,
  };

  return (
    <div className="sticky top-0 z-20 print:hidden">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-6 px-6 shadow-sm sm:px-10"
      >
        <BrandLockup module="Recepção" href="/recepcao" className="mr-auto" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções da recepção">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isCurrent = current === item.key;
            const badge = badgeFor[item.key] ?? 0;
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={true}
                aria-current={isCurrent ? "page" : undefined}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold no-underline transition-all rounded-t-md"
                style={{
                  color: "#FFFFFF",
                  background: isCurrent ? "rgba(255, 255, 255, 0.2)" : "transparent",
                  borderBottom: isCurrent ? "3px solid #FFFFFF" : "3px solid transparent",
                  opacity: isCurrent ? 1 : 0.85,
                }}
              >
                <Icon size={15} aria-hidden />
                {item.label}
                {badge > 0 && (
                  <span
                    className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-xs"
                    style={{
                      background: "#FFFFFF",
                      color: "#0F172A",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--color-accent-2)",
            color: "var(--color-accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 600,
          }}
        >
          R
        </span>
      </header>

      {/* Navegação compacta pra telas estreitas (a barra do topo esconde os itens) */}
      <nav
        className="flex w-full flex-wrap gap-1 border-b px-6 py-2 lg:hidden"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-200)" }}
        aria-label="Seções da recepção"
      >
        {NAV_ITEMS.map((item) => {
          const isCurrent = current === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              className="rounded-full px-2.5 py-1 text-xs font-semibold no-underline"
              style={{
                background: isCurrent ? "var(--color-accent)" : "var(--color-neutral-100)",
                color: isCurrent ? "#fff" : "var(--color-ink)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
