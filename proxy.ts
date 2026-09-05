import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
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
