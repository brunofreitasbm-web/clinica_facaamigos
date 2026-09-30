import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { CLINIC_WEBSITE } from "@/lib/clinic-identity";

const HOST_SITE = new URL(CLINIC_WEBSITE).hostname; // clinica.institutofacaamigos.com.br
const HOST_SISTEMA = "sistema.institutofacaamigos.com.br";

// Só a landing pública é indexável. Todo o resto (prontuário, agenda,
// faturamento, portal da família, check-in, ficha...) recebe noindex em toda
// resposta, além do Disallow do robots.txt no host do sistema.
const NOINDEX = "noindex, nofollow, noarchive, nosnippet";
const ARQUIVOS_DE_CRAWLER = new Set(["/robots.txt", "/sitemap.xml"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // clinica.institutofacaamigos.com.br é o endereço público da landing: a raiz
  // serve /site (sem redirecionar, para o buscador indexar ESTE endereço) e
  // nada mais mora aqui — qualquer outro caminho vai para o sistema.
  if (host === HOST_SITE) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/site";
      return NextResponse.rewrite(url);
    }
    if (pathname === "/site") {
      return NextResponse.redirect(new URL(`/${search}`, request.url), 308);
    }
    if (pathname.startsWith("/site/") || ARQUIVOS_DE_CRAWLER.has(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(`https://${HOST_SISTEMA}${pathname}${search}`, 308);
  }

  // No domínio do sistema, a landing tem um único endereço indexável: o da clínica.
  if (host === HOST_SISTEMA && pathname === "/site") {
    return NextResponse.redirect(`${CLINIC_WEBSITE}/${search}`, 308);
  }

  const response = await updateSession(request);
  if (!ARQUIVOS_DE_CRAWLER.has(pathname)) {
    response.headers.set("X-Robots-Tag", NOINDEX);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas exceto assets estáticos do Next, favicon e o
     * manifest do PWA — o manifest precisa ser buscável sem sessão (o
     * navegador o lê pra decidir "instalável" mesmo na tela de login).
     * Precisa rodar em toda navegação real pra manter a sessão renovada.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
