import type { MetadataRoute } from "next";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Robots.txt do domínio inteiro. Só `app/site` (a landing institucional) é
 * conteúdo público feito para ser indexado — todo o resto daqui é o
 * sistema de gestão da clínica: prontuário, agenda, faturamento, dado de
 * saúde de criança atrás de login. `app/checkin` e `app/ficha` também são
 * públicos (sem login), mas são fluxo funcional com token de uso único, não
 * conteúdo — não fazem sentido num resultado de busca, e indexá-los vazaria
 * a existência desses links.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/site"],
      disallow: ["/"],
    },
    sitemap: `${CLINIC_WEBSITE}/sitemap.xml`,
  };
}
