import { FaturamentoHeader } from "./faturamento-header";

/**
 * Layout do módulo Faturamento — monta o cabeçalho (FaturamentoHeader) em
 * toda tela do módulo, do mesmo jeito que app/recepcao/layout.tsx faz com a
 * RecepcaoNav. Antes cada page.tsx renderizava a própria cópia do header,
 * passando `active` na mão: a barra desmontava e remontava a cada
 * navegação.
 */
export default function FaturamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FaturamentoHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
