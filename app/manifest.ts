import type { MetadataRoute } from "next";
import { CLINIC_BRAND, CLINIC_NAME_DISPLAY } from "@/lib/clinic-identity";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: CLINIC_NAME_DISPLAY,
    short_name: CLINIC_BRAND,
    description:
      "Sistema de gestão da FaçaAmigos - Centro de Terapia Comportamental (TEA/TDAH).",
    start_url: "/terapeuta",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fb3d6a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Símbolo com 34% de área segura: o Android recorta em círculo/squircle.
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
