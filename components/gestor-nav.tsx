"use client";

import { MessageCircle, Smile } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";

/**
 * Cabeçalho do módulo Gestão. A barra em si é o <ModuleHeader>
 * compartilhado (10/09/2026, ver components/module-header.tsx); aqui fica
 * só a lista Painel/Cadastros/Financeiro (Dashboard.dc.html,
 * Cadastros.dc.html, Financeiro.dc.html).
 *
 * "Painel executivo" (Gestor.dc.html) não é um item desta barra — é
 * alcançado por um link dedicado a partir do Painel (ver
 * app/gestor/dashboard/page.tsx), por isso /gestor e /gestor/maturidade
 * ficam de fora do `noActiveOn`: nenhum item marca ativo nessas rotas.
 *
 * Como várias telas moram fora do prefixo do próprio grupo (bonificação e
 * metas são abas de Equipe, contratos é aba de Financeiro, ouvidoria é aba
 * de Auditoria), o `match` de cada item é a fonte de verdade — um simples
 * `startsWith(href)` não bastava.
 */
const NAV_ITEMS = [
  { key: "painel", label: "Painel", href: "/gestor/dashboard" },
  { key: "inteligencia", label: "Inteligência BI", href: "/gestor/inteligencia" },
  {
    key: "atendimento",
    label: "Central de Atendimento",
    href: "/recepcao/atendimento",
    icon: MessageCircle,
    // Único item que sai do módulo Gestão (outro layout, outro cabeçalho).
    // Não dá pra tornar a troca imperceptível — o que dá é torná-la
    // esperada, com o ícone de saída.
    external: true,
  },
  { key: "nps", label: "NPS", href: "/gestor/nps", icon: Smile },
  { key: "equipe", label: "Equipe", href: "/gestor/equipe", match: ["/gestor/equipe", "/gestor/bonificacao", "/gestor/metas"] },
  { key: "cadastros", label: "Cadastros", href: "/gestor/cadastros" },
  { key: "financeiro", label: "Financeiro", href: "/gestor/financeiro", match: ["/gestor/financeiro", "/gestor/contratos"] },
  { key: "auditoria", label: "Auditoria (LGPD)", href: "/gestor/auditoria", match: ["/gestor/auditoria", "/gestor/ouvidoria"] },
  { key: "configuracoes", label: "Configurações", href: "/gestor/configuracoes" },
] as const;

export function GestorNav({ npsBadge }: { npsBadge?: React.ReactNode }) {
  const items: ModuleNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    badgeSlot: item.key === "nps" ? npsBadge : undefined,
  }));

  return (
    <ModuleHeader
      module="Gestão"
      homeHref="/gestor"
      navLabel="Seções da gestão"
      items={items}
      noActiveOn={["/gestor/maturidade"]}
    />
  );
}
