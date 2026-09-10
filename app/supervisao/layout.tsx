import { SupervisaoTabProvider } from "./supervisao-tab-context";
import { SupervisaoHeader } from "@/components/supervisao-header";

/**
 * Layout do módulo Coordenação — monta o cabeçalho (SupervisaoHeader) em
 * toda tela do módulo, do mesmo jeito que os demais módulos (Recepção,
 * Gestão, Faturamento). Antes ele só existia dentro de app/supervisao/
 * page.tsx (via SupervisaoShell): sair pra qualquer uma das 5 outras rotas
 * do módulo perdia o cabeçalho por completo, ou caía numa versão bespoke
 * (lista-espera, prontuário-unificado) com nome de módulo e navegação
 * diferentes — cada uma virava um beco isolado, só com um link de volta.
 *
 * `<div>`, não `<main>`: cada page.tsx já tem o próprio `<main>` — envolver
 * de novo aqui aninharia dois landmarks `main` na mesma árvore.
 */
export default function SupervisaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupervisaoTabProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <SupervisaoHeader />
        {children}
      </div>
    </SupervisaoTabProvider>
  );
}
