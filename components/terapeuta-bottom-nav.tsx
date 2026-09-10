"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nav do portal do terapeuta — antes duplicada literalmente em
 * app/terapeuta/page.tsx e app/terapeuta/pacientes/page.tsx (cada uma
 * com o item ativo hardcoded diferente). Extraída pra app/terapeuta/agenda
 * e app/terapeuta/prontuario (e a ficha do paciente,
 * app/terapeuta/paciente/[patientId]/page.tsx) usarem a mesma nav sem
 * duplicar de novo.
 *
 * "Pendências" saiu (07/09→08/09/2026): era uma âncora de página
 * (`/terapeuta#pendencias`), não uma rota, e nenhum call site passava
 * `active="pendencias"` — a contagem já aparece no card de alerta da Hoje.
 * No lugar entraram Agenda e Prontuário, que são rotas de verdade.
 *
 * Abaixo de `md` (tablet), a barra inferior fixa é a navegação. A partir
 * de `md` ela some (`md:hidden`) e uma barra superior persistente assume
 * (`hidden md:flex`) — sem ela, a navegação principal desaparecia por
 * completo em qualquer tablet (08/09/2026).
 *
 * Vive em app/terapeuta/layout.tsx (10/09/2026). Antes era renderizada por
 * dentro de cada page.tsx, o que desmontava e remontava a barra a cada
 * navegação — e, como ficava depois do conteúdo, a barra superior `sticky`
 * só aparecia no fim da página. Os links eram `<a href>`, então todo clique
 * era um reload completo: era essa a "quebra" percebida ao trocar de tela.
 * O item ativo agora sai do pathname, não de uma prop por página.
 */
const NAV_ITEMS: Array<{
  key: NavKey;
  href: string;
  icon: string;
  label: string;
}> = [
  { key: "hoje", href: "/terapeuta", icon: "📅", label: "Hoje" },
  { key: "agenda", href: "/terapeuta/agenda", icon: "🗓", label: "Agenda" },
  { key: "pacientes", href: "/terapeuta/pacientes", icon: "👥", label: "Pacientes" },
  { key: "prontuario", href: "/terapeuta/prontuario", icon: "📋", label: "Prontuário" },
];

type NavKey = "hoje" | "agenda" | "pacientes" | "prontuario";

/**
 * A ficha do paciente e o prontuário compartilham o item "Prontuário"; a
 * evolução de sessão pertence à "Hoje" (é de lá que se entra nela). Ordem
 * importa: `/terapeuta/paciente` e `/terapeuta/pacientes` são prefixos
 * distintos e precisam ser testados antes do fallback de `/terapeuta`.
 */
function activeKey(pathname: string | null): NavKey | null {
  if (!pathname) return null;
  if (pathname === "/terapeuta" || pathname.startsWith("/terapeuta/evolucao")) return "hoje";
  if (pathname.startsWith("/terapeuta/agenda")) return "agenda";
  if (pathname.startsWith("/terapeuta/pacientes")) return "pacientes";
  if (pathname.startsWith("/terapeuta/prontuario") || pathname.startsWith("/terapeuta/paciente/")) {
    return "prontuario";
  }
  return null;
}

export function TerapeutaBottomNav({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const active = activeKey(pathname);

  // Só pro papel terapeuta de verdade — gestor/supervisor abrindo a evolução
  // pra assinar por um colega não usam a nav do portal do terapeuta. Sem
  // isso, este estado de leitura era um beco sem saída no celular (ver plano
  // "evolução mobile").
  if (pathname?.startsWith("/terapeuta/evolucao") && role !== "terapeuta") return null;

  const itemStyle = (key: NavKey) => ({
    color: active === key ? "var(--color-accent)" : "var(--color-neutral-600)",
    fontWeight: active === key ? 600 : 400,
  });

  return (
    <>
      <nav
        className="sticky top-0 z-10 hidden justify-center gap-2 border-b bg-white px-4 py-2 md:flex"
        style={{ borderColor: "var(--color-divider)" }}
        aria-label="Navegação do terapeuta"
      >
        {NAV_ITEMS.map(({ key, href, icon, label }) => (
          <Link
            key={key}
            href={href}
            prefetch={true}
            aria-current={active === key ? "page" : undefined}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-base no-underline"
            style={{
              ...itemStyle(key),
              minHeight: 44,
              background: active === key ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t bg-white py-2 text-[10px] md:hidden"
        style={{ borderColor: "var(--color-divider)" }}
        aria-label="Navegação do terapeuta"
      >
        {NAV_ITEMS.map(({ key, href, icon, label }) => (
          <Link
            key={key}
            href={href}
            prefetch={true}
            aria-current={active === key ? "page" : undefined}
            className="flex flex-col items-center gap-1 no-underline"
            style={{ ...itemStyle(key), minHeight: 44 }}
          >
            {icon} {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
