"use client";

import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, UserX, ListOrdered, Users, CalendarClock } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";
import { useSupervisaoTab, type SupervisaoTabKey } from "@/app/supervisao/supervisao-tab-context";

const TABS: { key: SupervisaoTabKey; label: string }[] = [
  { key: "grade", label: "Grade" },
  { key: "agenda1a", label: "Agenda 1ª Avaliação" },
  { key: "acolhimentos", label: "Planilha de Pacientes" },
  { key: "fluxos", label: "Fluxos" },
  { key: "planos", label: "PTS" },
  { key: "inbox", label: "Caixa de entrada" },
];

const LINKS = [
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users },
  { key: "lista-espera", label: "Lista de Espera", href: "/supervisao/lista-espera", icon: ListOrdered },
  { key: "prontuario-unificado", label: "Prontuário Unificado", href: "/supervisao/prontuario-unificado", icon: ShieldCheck },
  { key: "disponibilidade", label: "Disponibilidade", href: "/supervisao/disponibilidade", icon: CalendarClock },
  { key: "emergencias", label: "Aviso Falta Terapeuta", href: "/recepcao/emergencias", icon: UserX },
] as const;

/**
 * Cabeçalho do módulo Coordenação — o <ModuleHeader> compartilhado, vivendo
 * em app/supervisao/layout.tsx (10/09/2026) em vez de dentro de
 * app/supervisao/page.tsx (via SupervisaoShell). Antes ele só existia na
 * rota raiz; as outras 5 rotas do módulo ficavam sem cabeçalho nenhum ou
 * com uma versão bespoke e sem os atalhos das outras seções.
 *
 * As 6 primeiras entradas são abas de dados (useSupervisaoTab), não rotas —
 * só têm conteúdo em "/supervisao". Clicar numa delas fora da raiz navega
 * pra lá antes de selecionar, em vez de tentar trocar uma aba que não existe
 * na tela atual.
 */
export function SupervisaoHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { tab, setTab, counts } = useSupervisaoTab();
  const onRoot = pathname === "/supervisao";

  const items: ModuleNavItem[] = [
    ...TABS.map((t) => ({
      key: t.key,
      label: t.label,
      selected: onRoot && tab === t.key,
      badge: onRoot ? counts[t.key] : undefined,
      onSelect: () => {
        if (!onRoot) router.push("/supervisao");
        setTab(t.key);
      },
    })),
    ...LINKS.map((l) => ({ key: l.key, label: l.label, href: l.href, icon: l.icon })),
  ];

  return <ModuleHeader module="Coordenação" navLabel="Seções da coordenação" items={items} />;
}
