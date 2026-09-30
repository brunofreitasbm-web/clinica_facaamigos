import type { MetadataRoute } from "next";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

/**
 * Só a landing pública entra: o sistema de gestão nunca é listado (ver
 * app/robots.ts e proxy.ts). A landing é servida na raiz do domínio da clínica.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${CLINIC_WEBSITE}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
