"use client";

import { ModuleHeader } from "@/components/module-header";

const NAV_ITEMS = [
  { key: "competencia", label: "Competência", href: "/faturamento" },
  { key: "glosas", label: "Glosas", href: "/faturamento/glosas" },
  { key: "repasses", label: "Repasses", href: "/faturamento/repasses" },
] as const;

/**
 * Cabeçalho do módulo Faturamento — o <ModuleHeader> compartilhado (ver
 * components/module-header.tsx).
 */
export function FaturamentoHeader() {
  return <ModuleHeader module="Faturamento" homeHref="/faturamento" navLabel="Seções do faturamento" items={NAV_ITEMS} />;
}
