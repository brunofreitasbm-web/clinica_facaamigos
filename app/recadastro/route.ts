import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_RECADASTRO,
  consultarStatusRecadastro,
  decidirDestinoRecadastro,
  opcoesCookieRecadastro,
  pedirTicketRecadastro,
} from "@/lib/recadastro";

// Leva a pessoa à página de recadastro do Hub. O access_token fica só no servidor (nunca vai na URL):
// o Hub devolve um código de uso único dentro da URL. Se algo falhar, volta para "/" e nunca trava.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  let token: string | undefined;
  try {
    token = (await supabase.auth.getSession()).data.session?.access_token;
  } catch {
    token = undefined;
  }

  // Só pede o ticket se há token e o status é pendente; o resto é decidido por decidirDestinoRecadastro
  // (fail-open: qualquer falha grava cookie "ok" e volta a "/", sem laço de redirects).
  const status = token ? await consultarStatusRecadastro(token) : null;
  const url = token && status?.pendente ? await pedirTicketRecadastro(token) : null;
  const d = decidirDestinoRecadastro(status, url, !!token);

  const res =
    d.destino === "hub"
      ? NextResponse.redirect(d.url, 302)
      : NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(COOKIE_RECADASTRO, d.cookie, opcoesCookieRecadastro());
  return res;
}
