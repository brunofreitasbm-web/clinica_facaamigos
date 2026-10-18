import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  CLINIC_PUBLIC_ORIGIN,
  CLINIC_PUBLIC_PATH,
  CLINIC_PUBLIC_URL,
  CLINIC_STATIC_PREFIX,
  CLINIC_WEBSITE,
} from "@/lib/clinic-identity";

const HOST_SITE = new URL(CLINIC_WEBSITE).hostname; // clinica.institutofacaamigos.com.br
const HOST_SISTEMA = "sistema.institutofacaamigos.com.br";

// Só a landing pública é indexável. Todo o resto (prontuário, agenda,
// faturamento, portal da família, check-in, ficha...) recebe noindex em toda
// resposta, além do Disallow do robots.txt no host do sistema.
const NOINDEX = "noindex, nofollow, noarchive, nosnippet";
const ARQUIVOS_DE_CRAWLER = new Set(["/robots.txt"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // A landing pública é institutofacaamigos.com.br/clinica: o hub faz rewrite de /clinica para este
  // deploy e aqui a rota vira /site. Nenhuma outra página deste app é pública.
  //
  // clinica.institutofacaamigos.com.br é o endereço ANTIGO da landing e, ao mesmo tempo, a ORIGEM
  // para onde o hub faz rewrite (o projeto só é público nos domínios customizados; o *.vercel.app
  // exige login da Vercel). Por isso, nele: "/" e "/site" redirecionam (301, para o Google
  // transferir o ranking) para o endereço novo, "/clinica" é servida (o canonical já aponta para o
  // hub) e o resto vai para o sistema.
  if (host === HOST_SITE) {
    if (pathname === "/robots.txt") return NextResponse.next();
    if (pathname === "/" || pathname === "/site") {
      return NextResponse.redirect(`${CLINIC_PUBLIC_URL}${search}`, 301);
    }
    if (pathname === CLINIC_PUBLIC_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = "/site";
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith("/site/")) {
      return NextResponse.redirect(`${CLINIC_PUBLIC_ORIGIN}${CLINIC_STATIC_PREFIX}${pathname}${search}`, 301);
    }
    return NextResponse.redirect(`https://${HOST_SISTEMA}${pathname}${search}`, 308);
  }

  // No domínio do sistema a landing não existe: /clinica e /site respondem 404 (a landing mora só no
  // hub). Reescreve para um caminho sem rota, que cai no not-found do Next com status 404 e noindex.
  const caminhoDaLanding =
    pathname === "/site" ||
    pathname.startsWith("/site/") ||
    (pathname === CLINIC_PUBLIC_PATH && host === HOST_SISTEMA);
  if (caminhoDaLanding) {
    const url = request.nextUrl.clone();
    url.pathname = "/__nao-existe";
    const response = NextResponse.rewrite(url);
    response.headers.set("X-Robots-Tag", NOINDEX);
    return response;
  }

  // Desenvolvimento local e previews: /clinica serve a landing (em produção quem chega aqui é o host
  // da clínica, tratado acima).
  if (pathname === CLINIC_PUBLIC_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/site";
    return NextResponse.rewrite(url);
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
    "/((?!_next/static|_next/image|clinica-static/_next/static|clinica-static/_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
