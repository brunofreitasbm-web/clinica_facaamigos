"use client";

import { CalendarDays, Users, ShieldCheck, MessageSquare, FileText, DoorOpen, Trophy } from "lucide-react";
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
  { key: "pacientes", label: "Pacientes", href: "/recepcao/pacientes", icon: Users },
  { key: "a-autorizar", label: "Autorizações", href: "/recepcao/a-autorizar", match: ["/recepcao/a-autorizar", "/recepcao/pre-cadastros"], icon: ShieldCheck },
  { key: "atendimento", label: "Chat", href: "/recepcao/atendimento", icon: MessageSquare },
  { key: "documentos", label: "Documentos", href: "/recepcao/documentos", icon: FileText },
  // "Cadastro IA" (/recepcao/pre-cadastros) saiu da navegação em 20/09/2026:
  // a fila mostrava "Aguardando IA" em quase todo pré-cadastro e a recepção
  // ainda precisava abrir o chat pra entender o contato. Os mesmos rascunhos
  // agora entram em Autorizações. A tela "Pendências" também saiu da navegação
  // (04/11/2026): as pendências viraram pílulas na lista de Pacientes. A tela de
  // validação individual continua em /recepcao/pre-cadastros/[draftId].
  { key: "metricas", label: "Minha bonificação", href: "/recepcao/metricas", icon: Trophy },
] as const;

export function RecepcaoNav({
  chegadasCount,
  toAuthorizeCount,
}: {
  /** Leads do WhatsApp aguardando autorização do plano — ver app/recepcao/a-autorizar. */
  toAuthorizeCount?: number;
  /** Chegadas declaradas pelo QR ainda não confirmadas — ver app/recepcao/chegadas. */
  chegadasCount?: number;
}) {
  const items: ModuleNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.key === "chegadas" ? chegadasCount : item.key === "a-autorizar" ? toAuthorizeCount : undefined,
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
