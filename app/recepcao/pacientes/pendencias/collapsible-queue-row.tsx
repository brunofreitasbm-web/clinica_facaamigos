"use client";

import { useState, type ReactNode } from "react";

/**
 * Linha retrátil da fila de pendências: nome + resumo à esquerda funcionam
 * como o gatilho (clicar expande/recolhe o cartão), e o bloco da direita
 * (urgência, dono, reatribuir) fica fora do gatilho para os botões dele
 * continuarem clicáveis sem abrir/fechar a linha. O corpo fica montado mesmo
 * recolhido, para não perder o estado dos botões de cobrança de documento.
 */
export function CollapsibleQueueRow({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  aside: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 bg-transparent p-0 text-left"
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 inline-block shrink-0 text-ink-soft transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{title}</span>
            <span className="block text-ink-faint">{subtitle}</span>
          </span>
        </button>
        {aside}
      </div>
      <div hidden={!open}>{children}</div>
    </>
  );
}
