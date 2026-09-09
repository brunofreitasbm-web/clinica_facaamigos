import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Sem isso, o Turbopack sobe a árvore de pastas até achar um lockfile e
  // encontra C:\Users\bruno\package-lock.json (alheio a este projeto),
  // adota a pasta do usuário como raiz do workspace e passa a enxergar
  // `pages`/`app` de outras pastas por baixo dela — quebra build/dev com
  // "`pages` and `app` directories should be under the same folder".
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Evolução clínica precisa sobreviver a queda de conexão em atendimento
    // (PRD §6/§9.4): com isso, Server Actions em andamento (ex.: assinar
    // evolução) ficam retidas e reenviadas sozinhas quando a rede volta, em
    // vez de falhar. Ver app/manifest.ts e components/offline-banner.tsx.
    useOffline: true,
    serverActions: {
      // Default do Next é 1MB — quebra silenciosamente o upload do PDF de
      // acolhimento (uploadIntakeBatch, até 25MB) e também o upload direto
      // de documentos (uploadDocument). 26mb dá folga sobre o teto de 25MB
      // de arquivo aplicado nas próprias actions.
      bodySizeLimit: "26mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
