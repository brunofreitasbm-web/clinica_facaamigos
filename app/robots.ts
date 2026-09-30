import type { MetadataRoute } from "next";

/**
 * Robots.txt do domínio inteiro: nada aqui deve ser rastreado ou indexado.
 * O sistema de gestão da clínica (prontuário, agenda, faturamento, dado de
 * saúde de criança atrás de login) é privado, e a landing /site também ficou
 * fora dos buscadores por decisão de 30/09/2026 — o endereço curto
 * clinica.institutofacaamigos.com.br só redireciona para ela (next.config.ts).
 * `app/checkin` e `app/ficha` são fluxo funcional com token de uso único, não
 * conteúdo.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/"],
    },
  };
}
