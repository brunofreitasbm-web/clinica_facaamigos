"use client";

import { CalendarDays, Users, ShieldCheck, ListChecks, MessageSquare, FileText, DoorOpen, Trophy } from "lucide-react";
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
  // Fila de entrada é a tela principal do lead do WhatsApp (11/2026): mesmas famílias e mesmas ações de
  // Autorizações, com um único próximo passo por vez. O selo de contagem e o pré-cadastro moram nela.
  { key: "fila", label: "Fila de entrada", href: "/recepcao/fila", match: ["/recepcao/fila", "/recepcao/pre-cadastros"], icon: ListChecks },
  // Autorizações fica acessível durante a transição e sai do menu num passo seguinte.
  { key: "a-autorizar", label: "Autorizações", href: "/recepcao/a-autorizar", icon: ShieldCheck },
  { key: "atendimento", label: "Chat", href: "/recepcao/atendimento", icon: MessageSquare },
  { key: "documentos", label: "Documentos", href: "/recepcao/documentos", icon: FileText },
  // "Cadastro IA" (/recepcao/pre-cadastros) saiu da navegação em 20/09/2026:
  // a fila mostrava "Aguardando IA" em quase todo pré-cadastro e a recepção
  // ainda precisava abrir o chat pra entender o contato. Os mesmos rascunhos
  // agora entram em Autorizações. A tela "Pendências" também saiu da navegação
  // (04/11/2026): as pendências viraram pílulas na lista de Pacientes. A tela de
  // validação individual continua em /recepcao/pre-cadastros/[draftId].
] as const;

/** "Minha bonificação" mora no menu do operador (barra), não na lista de seções. */
const PERSONAL_LINKS = [{ key: "metricas", label: "Minha bonificação", href: "/recepcao/metricas", icon: Trophy }] as const;

export function RecepcaoNav({
  chegadasCount,
  toAuthorizeCount,
}: {
  /** Famílias novas do WhatsApp na Fila de entrada (mesma conta de Autorizações) — ver app/recepcao/fila. */
  toAuthorizeCount?: number;
  /** Chegadas declaradas pelo QR ainda não confirmadas — ver app/recepcao/chegadas. */
  chegadasCount?: number;
}) {
  const items: ModuleNavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.key === "chegadas" ? chegadasCount : item.key === "fila" ? toAuthorizeCount : undefined,
  }));

  return (
    <ModuleHeader
      module="Recepção"
      homeHref="/recepcao"
      navLabel="Seções da recepção"
      items={items}
      personalLinks={PERSONAL_LINKS}
    />
  );
}
