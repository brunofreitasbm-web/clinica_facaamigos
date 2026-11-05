"use client";

import { useTransition } from "react";
import { registerRenewalContact } from "./renew-guide-actions";

/**
 * "Renovar guia": o link do WhatsApp abre normalmente (nova aba) e, no mesmo
 * clique, o contato é registrado — sem esperar o registro para não atrasar nem
 * bloquear a abertura do WhatsApp.
 */
export function RenewGuideLink({ patientId, href, contacted }: { patientId: string; href: string; contacted: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={isPending}
      onClick={() => startTransition(() => void registerRenewalContact(patientId))}
      className="btn btn-secondary no-underline"
      title="Abre o WhatsApp com o pedido de renovação pronto para o responsável e registra o contato"
    >
      {contacted ? "Renovar de novo" : "Renovar guia"}
    </a>
  );
}
