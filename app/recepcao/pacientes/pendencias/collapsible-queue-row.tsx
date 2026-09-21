"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

/**
 * Linha retrátil da fila de pendências: nome + resumo à esquerda funcionam
 * como o gatilho (clicar expande/recolhe o cartão), e o bloco da direita
 * (urgência, dono, reatribuir) fica fora do gatilho para os botões dele
 * continuarem clicáveis sem abrir/fechar a linha. O corpo fica montado mesmo
 * recolhido, para não perder o estado dos botões de cobrança de documento.
 *
 * `onFirstOpen` (Server Action) dispara UMA vez, na primeira vez que a linha é
 * expandida — usado para ler os arquivos com IA só quando alguém vai olhar o
 * contato, nunca ao carregar a fila (a fila também roda no layout, para o badge).
 */
export function CollapsibleQueueRow({
  title,
  subtitle,
  aside,
  children,
  onFirstOpen,
}: {
  title: string;
  subtitle: ReactNode;
  aside: ReactNode;
  children: ReactNode;
  onFirstOpen?: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const firedRef = useRef(false);
  const [reading, startReading] = useTransition();

  const toggle = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && onFirstOpen && !firedRef.current) {
      firedRef.current = true;
      startReading(async () => {
        try {
          await onFirstOpen();
        } catch {
          // A leitura é só um acelerador: falha aqui não impede o trabalho manual.
        }
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
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
      {reading && open && <p className="m-0 mt-2 text-[12px] text-ink-faint">Lendo os documentos com IA…</p>}
      <div hidden={!open}>{children}</div>
    </>
  );
}
