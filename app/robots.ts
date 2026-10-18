import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Robots.txt por host (o mesmo deploy responde em vários domínios). O robots.txt público da landing é
 * o do hub (institutofacaamigos.com.br), que libera /clinica e /clinica-static:
 *
 * - clinica.institutofacaamigos.com.br: host antigo, só redireciona. Libera tudo para os 301 serem seguidos.
 * - qualquer outro host (sistema.…, previews): sistema de gestão da clínica,
 *   com dado de saúde de criança atrás de login. Nada é rastreado.
 *
 * O noindex por resposta (proxy.ts) é a segunda trava: vale mesmo se um
 * crawler ignorar este arquivo.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();

  // Host antigo da landing: libera tudo para o buscador conseguir seguir os redirects (301) para o
  // endereço novo. Quem responde é proxy.ts; não há conteúdo próprio aqui.
  if (host === new URL(CLINIC_WEBSITE).hostname) {
    return { rules: { userAgent: "*", allow: ["/"] } };
  }

  return { rules: { userAgent: "*", disallow: ["/"] } };
}
