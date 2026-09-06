"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  AlertCircle,
  MessageCircle,
  FileText,
  Boxes,
  UserPlus,
  CalendarPlus,
  Search,
} from "lucide-react";
import { RecepcaoCommandPalette, type PalettePatient } from "./recepcao-command-palette";

/**
 * Cabeçalho + barra de ações rápidas do módulo Recepção, renderizado pelo
 * app/recepcao/layout.tsx em TODAS as telas do módulo — o operador nunca
 * precisa "voltar" pra achar uma ferramenta: tudo que a recepção faz no dia
 * (agendar, cadastrar, confirmar amanhã, resolver pendência, buscar
 * paciente) está sempre a um clique, em qualquer página.
 */
const NAV_ITEMS = [
  { key: "agenda", label: "Agenda do dia", href: "/recepcao", icon: CalendarDays, exact: true },
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users, exact: false },
  { key: "pendencias", label: "Pendências", href: "/recepcao/pacientes/pendencias", icon: AlertCircle, exact: false },
  { key: "whatsapp", label: "Confirmar amanhã", href: "/recepcao/whatsapp", icon: MessageCircle, exact: false },
  { key: "documentos", label: "Documentos", href: "/recepcao/documentos", icon: FileText, exact: false },
  { key: "recursos", label: "Salas e recursos", href: "/recepcao/recursos", icon: Boxes, exact: false },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

function activeKey(pathname: string | null): NavKey | null {
  if (!pathname) return null;
  if (pathname === "/recepcao" || pathname.startsWith("/recepcao/agenda")) return "agenda";
  if (pathname.startsWith("/recepcao/pacientes/pendencias")) return "pendencias";
  if (pathname.startsWith("/recepcao/pacientes")) return "pacientes";
  if (pathname.startsWith("/recepcao/whatsapp")) return "whatsapp";
  if (pathname.startsWith("/recepcao/documentos")) return "documentos";
  if (pathname.startsWith("/recepcao/recursos")) return "recursos";
  return null;
}

export function RecepcaoNav({
  pendingCount,
  tomorrowUnconfirmedCount,
  patients,
}: {
  pendingCount: number;
  tomorrowUnconfirmedCount: number;
  patients: PalettePatient[];
}) {
  const pathname = usePathname();
  const current = activeKey(pathname);

  const badgeFor: Partial<Record<NavKey, number>> = {
    pendencias: pendingCount,
    whatsapp: tomorrowUnconfirmedCount,
  };

  return (
    <div className="sticky top-0 z-20 print:hidden">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-6 px-6 shadow-sm sm:px-10"
      >
        <Link href="/recepcao" className="mr-auto flex items-center gap-3 no-underline">
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden>
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
              · Recepção
            </span>
          </span>
        </Link>

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
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors"
                style={{
                  color: isCurrent ? "var(--color-accent)" : "var(--color-on-accent)",
                  background: isCurrent ? "var(--color-bg)" : "transparent",
                }}
              >
                <Icon size={15} aria-hidden />
                {item.label}
                {badge > 0 && (
                  <span
                    className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                    style={{
                      background: isCurrent ? "var(--color-accent)" : "var(--color-accent-2)",
                      color: "#fff",
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

      {/* Barra de ações rápidas — as 4 coisas que a recepção mais faz, com
          rótulo em linguagem do balcão e sempre visíveis. */}
      <div
        className="flex flex-wrap items-center gap-2 border-b px-6 py-2.5 sm:px-10"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-neutral-200)" }}
      >
        <span className="mr-1 hidden text-[11px] font-extrabold uppercase tracking-[0.12em] sm:inline" style={{ color: "var(--color-accent-2-700)" }}>
          Atalhos
        </span>
        <Link href="/recepcao#nova-sessao" prefetch={true} className="btn btn-primary text-[13px]">
          <CalendarPlus size={16} aria-hidden />
          Nova sessão
        </Link>
        <Link href="/recepcao/pacientes/novo" prefetch={true} className="btn btn-secondary text-[13px]">
          <UserPlus size={16} aria-hidden />
          Novo paciente
        </Link>
        <RecepcaoCommandPalette patients={patients}>
          <span className="btn btn-ghost text-[13px]">
            <Search size={16} aria-hidden />
            Buscar paciente
            <kbd
              className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--color-neutral-100)", color: "var(--color-neutral-600)" }}
            >
              Ctrl K
            </kbd>
          </span>
        </RecepcaoCommandPalette>
        <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--color-neutral-200)" }} />
        <Link href="/recepcao/whatsapp" prefetch={true} className="btn btn-ghost text-[13px]">
          <MessageCircle size={16} aria-hidden />
          Confirmar amanhã
          {tomorrowUnconfirmedCount > 0 && (
            <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: "var(--color-accent-2)" }}>
              {tomorrowUnconfirmedCount}
            </span>
          )}
        </Link>
        <Link href="/recepcao/pacientes/pendencias" prefetch={true} className="btn btn-ghost text-[13px]">
          <AlertCircle size={16} aria-hidden />
          Pendências
          {pendingCount > 0 && (
            <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: "var(--color-status-negative)" }}>
              {pendingCount}
            </span>
          )}
        </Link>

        {/* Navegação compacta pra telas estreitas (a barra do topo esconde os itens) */}
        <nav className="flex w-full flex-wrap gap-1 pt-1 lg:hidden" aria-label="Seções da recepção">
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
    </div>
  );
}
