import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Porta de entrada do Hub de Gestão (gestao.institutofacaamigos.com.br).
// O hub gera, com a service role, um magic link que nunca é enviado por
// e-mail e manda só o hashed_token para cá; verifyOtp troca esse token (uso
// único) por uma sessão normal em cookie, e "/" decide a tela pelo papel.
// Rota pública em lib/supabase/middleware.ts (PUBLIC_PREFIXES).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const destino = new URL(request.url);
  destino.search = "";

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) {
      destino.pathname = "/";
      return semReferrer(NextResponse.redirect(destino));
    }
    console.error("[auth/sso] verifyOtp falhou:", error.message);
  }

  destino.pathname = "/login";
  return semReferrer(NextResponse.redirect(destino));
}

function semReferrer(res: NextResponse) {
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
