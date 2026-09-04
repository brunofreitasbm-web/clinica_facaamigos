import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FaçaAmigos — Gestão Clínica",
  description: "Sistema de gestão da clínica TEA/TDAH FaçaAmigos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          THESIS: cada tela é uma medição, não um card de app de bem-estar —
          a home de cada papel lê como uma página de gráfico de crescimento
          preenchida com os dados daquele trabalho.
          OWN-WORLD: papel milimetrado quente (#faf8f3), tinta azul de
          caderneta clínica (#0f5c7d) como acento único, números em mono
          tabular como medições, bandeirinha dourada (#c9971f) pra marco
          atingido, status em cor consistente (positivo/pendente/ativo/
          negativo/neutro) definidos em app/globals.css.
          STORY: quem abre entende, na primeira tela, o que precisa fazer
          hoje nesse papel — sem menu, sem navegação pra achar o trabalho.
          FIRST VIEWPORT: cabeçalho com o nome do papel como rótulo de eixo,
          um cartão de medição real (dado do Supabase) provando a conexão
          ponta a ponta, grade de papel milimetrado visível no fundo.
          FORM: Gráfico de Crescimento Pediátrico — 6ª de 7 direções
          fundamentadas (clipboard ABA, painel split-flap, quadro
          magnético, cartão PECS, caderneta SUS, gráfico de crescimento,
          diário de classe), seed 2b7f8b5e, roll degradado (sem rede pro
          serviço de sorteio), assignedIndex 6, confirmado pelo usuário.
          FINISH: unreviewed and undocumented is unfinished; this build
          ends with the finish review, the verdict, DESIGN.md, and every
          shipping raster carrying its provenance.
        */}
        {children}
      </body>
    </html>
  );
}
