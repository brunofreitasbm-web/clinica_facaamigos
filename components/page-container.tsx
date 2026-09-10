import type { ReactNode } from "react";

/**
 * Largura padrão de conteúdo para telas Desktop (gestor, faturamento,
 * recepção, supervisão). Substitui os max-w ad hoc espalhados pelas páginas
 * (max-w-4xl, sem limite, etc.) por um teto único e generoso — largo o
 * suficiente para aproveitar monitores widescreen, mas evita linhas de
 * tabela/texto esticadas ao infinito em telas ultrawide.
 *
 * Não usar em Terapeuta/Família — esses módulos mantêm seu próprio layout.
 */
export function PageContainer({
  children,
  className = "",
  fullBleed = false,
}: {
  children: ReactNode;
  className?: string;
  /** Remove o teto de largura para telas que já controlam sua própria grade (ex: dashboards com colunas fixas). */
  fullBleed?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-6 p-6 sm:p-8 xl:p-10 w-full ${
        fullBleed ? "" : "max-w-[1600px]"
      } mx-auto ${className}`}
    >
      {children}
    </div>
  );
}
