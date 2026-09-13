import type { ReactNode } from "react";

/**
 * Largura padrão de conteúdo para telas Desktop (gestor, faturamento,
 * recepção, supervisão). Substitui os max-w ad hoc espalhados pelas páginas
 * (max-w-4xl, sem limite, etc.) por um teto único e generoso — largo o
 * suficiente para aproveitar monitores widescreen, mas evita linhas de
 * tabela/texto esticadas ao infinito em telas ultrawide.
 *
 * 1600px é o teto até xl; em telas 2xl+ (ex.: monitores de 27" em 2560px)
 * sobe pra 1920px — recepção e supervisão ganham mais espaço de fato em vez
 * de só margem lateral maior.
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
        fullBleed ? "" : "max-w-[1600px] 2xl:max-w-[1920px]"
      } mx-auto ${className}`}
    >
      {children}
    </div>
  );
}
