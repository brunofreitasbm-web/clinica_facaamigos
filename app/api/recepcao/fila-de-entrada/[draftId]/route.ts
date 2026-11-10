// app/api/recepcao/fila-de-entrada/[draftId]/route.ts
//
// Detalhe pesado de um caso da Fila de entrada (arquivos, dados lidos, mensagens, cobranças, pendências),
// carregado quando o caso é aberto. A lista só recebe campos leves (intake-list-item-pure.ts).
//
// Devolve o MESMO rascunho consolidado em que a lista se baseia (getConsolidatedRegistrationDraft), para
// lista e detalhe nunca divergirem em etapa, pipeline ou pendências. Custo: refaz a consulta e a
// consolidação da fila no servidor a cada abertura (nada disso viaja ao navegador).
//
// Route Handler (GET) e não Server Action: as Server Actions do Next rodam uma por vez no cliente, então
// trocar de caso depressa enfileiraria as buscas atrás umas das outras e atrás das ações de gravação.
//
// Usa o client de sessão: a RLS de registration_drafts já restringe a leitura à equipe da clínica.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/file-access-server";
import { getConsolidatedRegistrationDraft } from "@/lib/reception-queue";
import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_request: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  // Sessão primeiro: quem não está logado não descobre nem se o id é válido.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  const { draftId } = await ctx.params;
  if (!isUuid(draftId)) return NextResponse.json({ error: "Caso inválido." }, { status: 400, headers: NO_STORE });

  const draft = await getConsolidatedRegistrationDraft(supabase, draftId);
  if (!draft) return NextResponse.json({ error: "Este caso não foi encontrado." }, { status: 404, headers: NO_STORE });
  return NextResponse.json(draft, { headers: NO_STORE });
}
