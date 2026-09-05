import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FaçaAmigos — Gestão Clínica",
    short_name: "FaçaAmigos",
    description: "Sistema de gestão da clínica TEA/TDAH FaçaAmigos.",
    start_url: "/terapeuta",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#14284b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
