"use client";

import { MessageCircle, Smile } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";

/**
 * Cabeçalho do módulo Gestão — o <ModuleHeader> compartilhado (ver
 * components/module-header.tsx), como Recepção, Faturamento e Coordenação.
 *
 * Vive em app/gestor/layout.tsx (10/09/2026). Antes era renderizada por
 * dentro de 20 page.tsx/loading.tsx, cada uma passando `active` na mão: a
 * barra desmontava e remontava a cada navegação, e nos loadings vinha com
 * `active={null}` — o sublinhado sumia no meio da transição e reaparecia em
 * outro item. Era essa a "quebra" percebida ao trocar de módulo.
 *
 * O item ativo agora sai do pathname (dentro do ModuleHeader). Como várias
 * telas moram fora do prefixo do próprio grupo (bonificação e metas são
 * abas de Equipe, contratos é aba de Financeiro, ouvidoria é aba de
 * Auditoria), o `match` de cada item é a fonte de verdade.
 */
const NAV_ITEMS = [
  { key: "painel", label: "Painel", href: "/gestor/dashboard" },
  { key: "inteligencia", label: "Inteligência BI", href: "/gestor/inteligencia" },
  {
    key: "atendimento",
    label: "Central de Atendimento",
    href: "/recepcao/atendimento",
    icon: MessageCircle,
    // Único item que sai do módulo Gestão pra outro (outro layout, outro
    // cabeçalho) — ganha o ícone de saída em vez de fingir que é interno.
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
      // Painel executivo (/gestor) e Maturidade não são itens desta barra —
      // nenhum item fica sublinhado nessas duas telas.
      noActiveOn={["/gestor/maturidade"]}
    />
  );
}
