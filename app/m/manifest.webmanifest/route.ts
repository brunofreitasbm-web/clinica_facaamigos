import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";

/**
 * Manifest próprio do PWA "Atendimento", servido em /m/manifest.webmanifest.
 *
 * Não é um app/manifest.ts (convenção especial de metadata) porque ESTA
 * versão do Next só reconhece manifest.(ts|js) na RAIZ de app/ — ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md
 * ("Add ... in the root of app directory"). Um app/m/manifest.ts nesta
 * versão é só um módulo comum, não gera rota nenhuma (confirmado: sumiu do
 * `next build` route list). Por isso o manifest do módulo mobile é uma Route
 * Handler manual, referenciada em app/m/layout.tsx via
 * `metadata.manifest = "/m/manifest.webmanifest"`, scoped a start_url/scope
 * "/m/" pra instalar separado do app principal (app/manifest.ts).
 */
function manifest(): MetadataRoute.Manifest {
  return {
    name: "FaçaAmigos Atendimento",
    short_name: "Atendimento",
    description: "Fila de WhatsApp da recepção FaçaAmigos, para celular.",
    start_url: "/m/atendimento",
    scope: "/m/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#065264",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}

export function GET() {
  return NextResponse.json(manifest(), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
