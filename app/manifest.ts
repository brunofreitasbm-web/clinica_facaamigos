import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FaçaAmigos — Gestão Clínica",
    short_name: "FaçaAmigos",
    description: "Sistema de gestão da clínica TEA/TDAH FaçaAmigos.",
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
