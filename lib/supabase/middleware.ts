import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, type Role } from "@/lib/roles";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  // Checagem de Modo Demo Local
  const demoRole = request.cookies.get("demo_user_role")?.value as Role | undefined;
  const isDemo = Boolean(demoRole);

  if (isDemo) {
    if (isPublicPath) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const home = demoRole ? ROLE_HOME[demoRole] : undefined;
    if (demoRole && demoRole !== "gestor" && home && !pathname.startsWith(home)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    return response;
  }

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

      if (role && role !== "gestor" && home && !pathname.startsWith(home)) {
        return NextResponse.redirect(new URL(home, request.url));
      }
    }
  } catch {
    if (!isPublicPath) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

