"use client";

import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";

/**
 * Cabeçalho do módulo Acompanhamento Terapêutico (AT) — mesmo <ModuleHeader>
 * compartilhado de Gestão/Recepção/Faturamento (ver components/module-header.tsx).
 * Um item só no MVP: a lista de pacientes do profissional de AT logado.
 */
const NAV_ITEMS = [{ key: "pacientes", label: "Pacientes", href: "/at" }] as const;

export function AtNav() {
  const items: ModuleNavItem[] = [...NAV_ITEMS];

  return <ModuleHeader module="Acompanhamento Terapêutico" homeHref="/at" navLabel="Seções do AT" items={items} />;
}
