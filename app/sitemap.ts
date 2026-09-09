import type { MetadataRoute } from "next";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Uma única URL: a landing (app/site) é a única página pública indexável do
 * domínio (ver app/robots.ts). Quando o site ganhar mais páginas de
 * conteúdo (ex.: /site/blog), acrescente aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${CLINIC_WEBSITE}/site`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
