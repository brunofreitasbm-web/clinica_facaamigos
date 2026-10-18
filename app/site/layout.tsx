import type { Metadata } from "next";
import { CLINIC_PUBLIC_ORIGIN } from "@/lib/clinic-identity";
import { SiteAnalytics, SiteAnalyticsNoScript } from "./analytics";
import { SiteEngagement } from "./engagement";

/**
 * Layout de app/site — só resolve URL absoluta (metadataBase) e injeta as
 * tags de rastreio (analytics.tsx), escopadas a esta subárvore. O resto do
 * app (prontuário, agenda, faturamento) não carrega nada disso.
 */
export const metadata: Metadata = {
  metadataBase: new URL(CLINIC_PUBLIC_ORIGIN),
  // A landing é servida no domínio do hub: ícones e manifest são os do hub (os do app, em /icon.svg,
  // /apple-icon.png e /manifest.webmanifest, não existem lá).
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  manifest: "/site.webmanifest",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteAnalyticsNoScript />
      <SiteAnalytics />
      <SiteEngagement />
      {/* .site-brand (globals.css): tokens e tipografia do hub FaçaAmigos só na landing pública, sem tocar no sistema interno. */}
      <div className="site-brand">{children}</div>
    </>
  );
}
