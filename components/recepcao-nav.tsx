"use client";

import { CalendarDays, Users, AlertCircle, Inbox, FileText, Sparkles, UserX, DoorOpen, Trophy, HeartHandshake } from "lucide-react";
import { ModuleHeader, type ModuleNavItem } from "@/components/module-header";

/**
 * Cabeçalho do módulo Recepção, renderizado pelo app/recepcao/layout.tsx
 * em TODAS as telas do módulo.
 *
 * A barra em si é o <ModuleHeader> compartilhado (10/09/2026) — aqui fica só
 * a lista de itens e os badges que o layout busca no banco.
 */
const NAV_ITEMS = [
  { key: "agenda", label: "Agenda do dia", href: "/recepcao", match: ["/recepcao", "/recepcao/agenda"], icon: CalendarDays },
  { key: "chegadas", label: "Chegadas", href: "/recepcao/chegadas", icon: DoorOpen },
  { key: "acolhimentos", label: "Acolhimentos", href: "/recepcao/acolhimentos", icon: HeartHandshake },
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users },
  { key: "pendencias", label: "Pendências", href: "/recepcao/pacientes/pendencias", icon: AlertCircle },
  { key: "atendimento", label: "Atendimento", href: "/recepcao/atendimento", icon: Inbox },
  { key: "documentos", label: "Documentos", href: "/recepcao/documentos", icon: FileText },
  { key: "precadastros", label: "Cadastro IA", href: "/recepcao/pre-cadastros", icon: Sparkles },
  { key: "emergencias", label: "Aviso Falta Terapeuta", href: "/recepcao/emergencias", icon: UserX },
  { key: "metricas", label: "Minha bonificação", href: "/recepcao/metricas", icon: Trophy },
] as const;

export function RecepcaoNav({
  pendingCount,
  chegadasCount,
  acolhimentosCount,
}: {
  /**
   * `null` enquanto os badges ainda não chegaram (ver
   * app/recepcao/nav-badges.tsx, que busca isto sob <Suspense> pra não
   * bloquear a pintura do menu) — nesse estado o badge simplesmente não
   * aparece, igual a 0.
   */
  pendingCount: number | null;
  /** Chegadas declaradas pelo QR ainda não confirmadas — ver app/recepcao/chegadas. */
  chegadasCount?: number | null;
  /** Acolhimentos aguardando agendamento ou pagamento — ver app/recepcao/acolhimentos. */
  acolhimentosCount?: number | null;
}) {
  const items: ModuleNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      (item.key === "pendencias"
        ? pendingCount
        : item.key === "chegadas"
          ? chegadasCount
          : item.key === "acolhimentos"
            ? acolhimentosCount
            : undefined) ?? undefined,
  }));

  return (
    <ModuleHeader
      module="Recepção"
      homeHref="/recepcao"
      navLabel="Seções da recepção"
      items={items}
      actions={
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
      }
    />
  );
}
