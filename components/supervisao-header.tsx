"use client";

import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, UserX, ListOrdered, Users, CalendarClock, Trophy, Boxes, CalendarDays } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";
import { useSupervisaoTab, type SupervisaoTabKey } from "@/app/supervisao/supervisao-tab-context";

const TABS: { key: SupervisaoTabKey; label: string }[] = [
  { key: "agenda1a", label: "Agenda 1ª Avaliação" },
  { key: "fluxos", label: "Fluxos" },
  { key: "planos", label: "PTS" },
  { key: "inbox", label: "Caixa de entrada" },
];

const LINKS = [
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users },
  { key: "lista-espera", label: "Lista de Espera", href: "/supervisao/lista-espera", icon: ListOrdered },
  { key: "prontuario-unificado", label: "Prontuário Unificado", href: "/supervisao/prontuario-unificado", icon: ShieldCheck },
  { key: "disponibilidade", label: "Disponibilidade", href: "/supervisao/disponibilidade", icon: CalendarClock },
  { key: "recursos", label: "Salas e recursos", href: "/supervisao/recursos", icon: Boxes },
  { key: "emergencias", label: "Aviso Falta Terapeuta", href: "/recepcao/emergencias", icon: UserX },
  { key: "metricas", label: "Minha bonificação", href: "/supervisao/metricas", icon: Trophy },
] as const;

/**
 * Cabeçalho do módulo Coordenação — o <ModuleHeader> compartilhado, vivendo
 * em app/supervisao/layout.tsx (10/09/2026) em vez de dentro de
 * app/supervisao/page.tsx (via SupervisaoShell). Antes ele só existia na
 * rota raiz; as outras 5 rotas do módulo ficavam sem cabeçalho nenhum ou
 * com uma versão bespoke e sem os atalhos das outras seções.
 *
 * As 4 primeiras entradas são abas de dados (useSupervisaoTab), não rotas —
 * só têm conteúdo em "/supervisao". Clicar numa delas fora da raiz navega
 * pra lá antes de selecionar, em vez de tentar trocar uma aba que não existe
 * na tela atual.
 *
 * O botão "Agenda" (canto direito, renomeado de "Agenda Manual" em
 * 14/09/2026) não é uma aba: abre a grade semanal completa em tela cheia
 * por cima de qualquer rota do módulo — é o único ponto de entrada pra
 * essa visão desde que a antiga aba "Grade" foi removida por redundância
 * (14/09/2026). Dentro dela vive o botão "Editar", pra permuta manual de
 * pacientes entre sessões (ver grade-panel.tsx).
 */
export function SupervisaoHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { tab, setTab, counts, urgent, setManualScheduleOpen } = useSupervisaoTab();
  const onRoot = pathname === "/supervisao";

  const items: ModuleNavItem[] = [
    ...TABS.map((t) => ({
      key: t.key,
      label: t.label,
      selected: onRoot && tab === t.key,
      badge: onRoot ? counts[t.key] : undefined,
      badgeUrgent: onRoot ? urgent[t.key] : undefined,
      onSelect: () => {
        if (!onRoot) router.push("/supervisao");
        setTab(t.key);
      },
    })),
    ...LINKS.map((l) => ({ key: l.key, label: l.label, href: l.href, icon: l.icon })),
  ];

  return (
    <ModuleHeader
      module="Coordenação"
      navLabel="Seções da coordenação"
      items={items}
      actions={
        <button
          type="button"
          onClick={() => {
            if (!onRoot) router.push("/supervisao");
            setManualScheduleOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold no-underline transition-all duration-150 active:scale-95 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ background: "var(--color-on-accent)", color: "var(--color-accent)" }}
        >
          <CalendarDays size={15} aria-hidden />
          Agenda
        </button>
      }
    />
  );
}
