import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Robots.txt por host (o mesmo deploy responde nos dois domínios). A página pública da Clínica é do
 * hub (institutofacaamigos.com.br/clinica); aqui nada é indexável:
 *
 * - clinica.institutofacaamigos.com.br: host antigo, só redireciona (301). Libera tudo para o
 *   buscador seguir o redirect.
 * - qualquer outro host (sistema.…, previews): sistema de gestão da clínica,
 *   com dado de saúde de criança atrás de login. Nada é rastreado.
 *
 * O noindex por resposta (proxy.ts) é a segunda trava: vale mesmo se um
 * crawler ignorar este arquivo.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();

  // Host antigo da landing: libera tudo para o buscador conseguir seguir o redirect (301) para o hub.
  if (host === new URL(CLINIC_WEBSITE).hostname) {
    return { rules: { userAgent: "*", allow: ["/"] } };
  }

  return { rules: { userAgent: "*", disallow: ["/"] } };
}
