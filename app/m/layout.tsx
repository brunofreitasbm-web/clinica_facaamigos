import type { Metadata, Viewport } from "next";

/**
 * Layout do PWA "Atendimento" (mobile). Diferente de app/recepcao/layout.tsx,
 * aqui NÃO entra o RecepcaoNav (barra de navegação de desktop) — a tela é
 * pensada pra caber inteira num celular, com sua própria fila/chat em tela
 * cheia. ToastProvider/OfflineBanner/AuthStatus já vêm do RootLayout
 * (app/layout.tsx), que envolve toda a árvore de rotas.
 */
export const metadata: Metadata = {
  title: "Atendimento",
  manifest: "/m/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Atendimento",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#065264",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function MobileAtendimentoLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
