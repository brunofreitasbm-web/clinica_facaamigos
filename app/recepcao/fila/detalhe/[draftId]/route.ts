// app/recepcao/fila/detalhe/[draftId]/route.ts
//
// Detalhe de uma família da Fila de entrada (/recepcao/fila), carregado quando o operador a seleciona.
// A lista só leva o resumo (FilaItem); arquivos, dados lidos, cobranças e pendências vêm daqui.
//
// Mora sob /recepcao (e não /api) porque o guard de papel do middleware só libera, para recepção e
// supervisão, os prefixos do papel (lib/roles.ts, isPathAllowedForRole); em /api o fetch era redirecionado
// para a home e recebia HTML. Sessão expirada também é redirecionada pelo middleware (para /login) antes de
// chegar aqui; o cliente trata isso (classifyDetailResponse). O 401 abaixo fica como defesa.
//
// Devolve o MESMO caso consolidado em que a lista se baseia: `?ids=` traz os rascunhos que a lista mesclou
// nesta família (FilaItem.memberDraftIds) e getConsolidatedRegistrationDraft consolida só eles, sem reler a
// fila inteira. É uma leitura: a consolidação fica em memória e nunca grava a mesclagem no banco.
//
// Route Handler (GET) e não Server Action: as Server Actions rodam uma por vez no cliente, então trocar de
// família depressa enfileiraria as buscas atrás umas das outras e atrás das ações de gravação.
//
// Usa o client de sessão: a RLS de registration_drafts já restringe a leitura à equipe da clínica.
// Dados de paciente: toda resposta vai com Cache-Control private, no-store.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/file-access-server";
import { getConsolidatedRegistrationDraft } from "@/lib/reception-queue";
import { parseMemberIds, toFilaDetail } from "@/lib/fila/fila-detail-pure";
import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  // Sessão primeiro: quem não está logado não descobre nem se o id é válido.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  const { draftId } = await ctx.params;
  const memberIds = isUuid(draftId) ? parseMemberIds(request.nextUrl.searchParams.get("ids"), draftId) : null;
  if (!memberIds) return NextResponse.json({ error: "Caso inválido." }, { status: 400, headers: NO_STORE });

  const draft = await getConsolidatedRegistrationDraft(supabase, draftId, memberIds);
  if (!draft) return NextResponse.json({ error: "Este caso não foi encontrado." }, { status: 404, headers: NO_STORE });
  return NextResponse.json(toFilaDetail(draft), { headers: NO_STORE });
}
