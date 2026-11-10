import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, isPathAllowedForRole, type Role } from "@/lib/roles";
import { isNextError } from "@/lib/next-utils";
import { isProfileBlocked } from "@/lib/profile-access";
import { PUBLIC_PREFIXES } from "@/lib/public-paths";
import {
  COOKIE_RECADASTRO,
  decidirRedirecionamentoRecadastro,
  RECADASTRO_PATH,
  contaIsentaDeRecadastro,
} from "@/lib/recadastro";

const LOGIN_PATH = "/login";
const CHANGE_PASSWORD_PATH = "/trocar-senha";

// Rotas que só exigem sessão válida, sem o guard de papel abaixo: os links de
// "abrir arquivo" (/api/arquivos/*) aparecem em telas de vários papéis
// (prontuário do terapeuta, ficha da recepção, acolhimento da supervisão...)
// e nenhum prefixo de ROLE_ALLOWED_PREFIXES cobre todos. A decisão de acesso
// de verdade é do próprio route handler (RLS via client de sessão).
const SESSION_ONLY_PREFIXES = ["/api/arquivos", "/api/ux-events"];

function isSessionOnlyPath(pathname: string): boolean {
  return SESSION_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicRequestPath(pathname: string): boolean {
  return (
    pathname === LOGIN_PATH ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublicPath = isPublicRequestPath(pathname);

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Só /login expulsa quem já está logado. Antes qualquer isPublicPath
    // fazia isso, o que chutaria uma recepcionista autenticada de volta pra
    // "/" ao tentar abrir /checkin para conferir o cartaz — path público não
    // deve implicar "só para deslogado".
    if (user && pathname === LOGIN_PATH) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Um usuário logado abrindo a tela pública do check-in (para testar o
    // cartaz, por exemplo) segue por ela normalmente — nem troca de senha
    // obrigatória nem o guard de papel abaixo se aplicam a esse caminho.
    if (user && !isPublicPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, must_change_password, active")
        .eq("id", user.id)
        .maybeSingle();

      // Colaborador desativado (pelo gestor ou pelo Hub de Gestão) não entra nem com sessão aberta:
      // encerra a sessão e volta ao login com o aviso. O /login é público, então não há laço.
      if (isProfileBlocked(profile)) {
        await supabase.auth.signOut();
        const blocked = NextResponse.redirect(new URL("/login?blocked=true", request.url));
        response.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
        return blocked;
      }

      if (profile?.must_change_password && pathname !== CHANGE_PASSWORD_PATH) {
        return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
      }
      if (!profile?.must_change_password && pathname === CHANGE_PASSWORD_PATH) {
        return NextResponse.redirect(new URL("/", request.url));
      }

      // Recadastro obrigatório (só depois do prazo de 7 dias, quando o signIn gravou "bloquear" no cookie).
      // O cookie é otimização de UX, não controle de acesso: o Hub é a autoridade e nada aqui chama a rede.
      // Responsáveis e contas de quiosque/estagiário nunca são redirecionados.
      if (
        decidirRedirecionamentoRecadastro(request.cookies.get(COOKIE_RECADASTRO)?.value, pathname) &&
        !contaIsentaDeRecadastro(
          profile?.role,
          (user.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined,
        )
      ) {
        return NextResponse.redirect(new URL(RECADASTRO_PATH, request.url));
      }

      if (
        pathname !== "/" &&
        pathname !== CHANGE_PASSWORD_PATH &&
        pathname !== RECADASTRO_PATH &&
        !isSessionOnlyPath(pathname)
      ) {
        const role = profile?.role as Role | undefined;
        // Regra pura em lib/roles.ts (testada): home + prefixos do papel; gestor isento.
        if (role && !isPathAllowedForRole(role, pathname)) {
          return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
        }
      }
    }
  } catch (error) {
    // Antes isto engolia qualquer exceção (falha de rede ao Supabase, env
    // var ausente) e mandava pra /login sem log algum — uma falha de
    // infraestrutura virava, na prática, um "logout" silencioso e
    // indistinguível de sessão expirada. Loga antes de decidir o que fazer;
    // erros internos de controle de fluxo do Next (redirect/notFound) não
    // devem ser tratados como falha real, daí o `isNextError`.
    if (!isNextError(error)) {
      console.error("[updateSession] Erro ao validar sessão:", error);
    }
    if (!isPublicPath) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

