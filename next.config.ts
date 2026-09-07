import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
