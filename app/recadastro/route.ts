import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_RECADASTRO,
  consultarStatusRecadastro,
  cookieDoStatus,
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

  const inicio = () => NextResponse.redirect(new URL("/", request.url));
  if (!token) return inicio();

  const status = await consultarStatusRecadastro(token);
  if (!status || !status.pendente) {
    const res = inicio();
    res.cookies.set(COOKIE_RECADASTRO, "ok", opcoesCookieRecadastro());
    return res;
  }

  const url = await pedirTicketRecadastro(token);
  if (!url) return inicio();

  const res = NextResponse.redirect(url, 302);
  res.cookies.set(COOKIE_RECADASTRO, cookieDoStatus(status), opcoesCookieRecadastro());
  return res;
}
