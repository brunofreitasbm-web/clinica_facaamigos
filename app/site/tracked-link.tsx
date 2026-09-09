"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackContactClick } from "./analytics-client";

/**
 * <a> comum, mas que dispara o evento "contact" (GA4/Meta Pixel/dataLayer)
 * antes de abrir o WhatsApp. Existe como componente à parte porque
 * page.tsx é Server Component — só o clique precisa de "use client", não a
 * seção inteira.
 */
export function TrackedWhatsAppLink({
  local,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { local: string }) {
  return (
    <a {...props} onClick={() => trackContactClick("whatsapp", local)}>
      {children}
    </a>
  );
}
