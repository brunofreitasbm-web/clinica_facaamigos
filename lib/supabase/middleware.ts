import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, ROLE_ALLOWED_PREFIXES, type Role } from "@/lib/roles";
import { isNextError } from "@/lib/next-utils";

const LOGIN_PATH = "/login";
const CHANGE_PASSWORD_PATH = "/trocar-senha";

// Prefixos abertos: a tela pública do check-in por QR (app/checkin) e sua
// API (app/api/checkin). Precisam ser prefixo, não igualdade exata, porque o
// token do cartaz vai no path (/checkin/<token>). "/login" continua tratado
// à parte por igualdade — é o único caminho que também expulsa quem já está
// logado (ver o uso de LOGIN_PATH abaixo); um recepcionista logado precisa
// conseguir abrir /checkin para testar o cartaz sem ser redirecionado.
const PUBLIC_PREFIXES = ["/checkin", "/api/checkin"];

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
        .select("role, must_change_password")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.must_change_password && pathname !== CHANGE_PASSWORD_PATH) {
        return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
      }
      if (!profile?.must_change_password && pathname === CHANGE_PASSWORD_PATH) {
        return NextResponse.redirect(new URL("/", request.url));
      }

      if (pathname !== "/" && pathname !== CHANGE_PASSWORD_PATH) {
        const role = profile?.role as Role | undefined;
        const home = role ? ROLE_HOME[role] : undefined;

        if (role && role !== "gestor" && home) {
          const allowedPrefixes = [home, ...ROLE_ALLOWED_PREFIXES[role]];
          const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
          if (!isAllowed) {
            return NextResponse.redirect(new URL(home, request.url));
          }
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

