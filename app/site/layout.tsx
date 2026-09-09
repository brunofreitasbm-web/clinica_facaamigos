import type { Metadata } from "next";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";
import { SiteAnalytics, SiteAnalyticsNoScript } from "./analytics";

/**
 * Layout de app/site — só resolve URL absoluta (metadataBase) e injeta as
 * tags de rastreio (analytics.tsx), escopadas a esta subárvore. O resto do
 * app (prontuário, agenda, faturamento) não carrega nada disso.
 */
export const metadata: Metadata = {
  metadataBase: new URL(CLINIC_WEBSITE),
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteAnalyticsNoScript />
      <SiteAnalytics />
      {children}
    </>
  );
}
