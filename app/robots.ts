import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Robots.txt por host (o mesmo deploy responde nos dois domínios):
 *
 * - clinica.institutofacaamigos.com.br: landing pública, feita para buscadores
 *   e assistentes de IA. Libera só a raiz, os assets que a renderizam
 *   (/_next, /site) e bloqueia o resto.
 * - qualquer outro host (sistema.…, previews): sistema de gestão da clínica,
 *   com dado de saúde de criança atrás de login. Nada é rastreado.
 *
 * O noindex por resposta (proxy.ts) é a segunda trava: vale mesmo se um
 * crawler ignorar este arquivo.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();

  if (host === new URL(CLINIC_WEBSITE).hostname) {
    return {
      rules: {
        userAgent: "*",
        allow: ["/$", "/_next/", "/site/"],
        disallow: ["/"],
      },
      sitemap: `${CLINIC_WEBSITE}/sitemap.xml`,
      host: CLINIC_WEBSITE,
    };
  }

  return { rules: { userAgent: "*", disallow: ["/"] } };
}
