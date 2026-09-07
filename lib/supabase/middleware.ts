import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, ROLE_ALLOWED_PREFIXES, type Role } from "@/lib/roles";
import { isNextError } from "@/lib/next-utils";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

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

    if (user && isPublicPath) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (user && pathname !== "/") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

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

