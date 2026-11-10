// app/api/recepcao/fila-de-entrada/[draftId]/route.ts
//
// Detalhe pesado de um caso da Fila de entrada (arquivos, dados lidos, mensagens, cobranças, pendências),
// carregado quando o caso é aberto. A lista só recebe campos leves (intake-list-item-pure.ts).
//
// Route Handler (GET) e não Server Action: as Server Actions do Next rodam uma por vez no cliente, então
// trocar de caso depressa enfileiraria as buscas atrás umas das outras e atrás das ações de gravação.
//
// Usa o client de sessão: a RLS de registration_drafts já restringe a leitura à equipe da clínica.
// `?merged=N` vem da lista: o rascunho avulso não sabe quantas conversas foram unificadas (os arquivos e
// dados mesclados já estão gravados no rascunho principal, ver persistDraftMergeInDb).
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid, requireSession } from "@/lib/file-access-server";
import { getSingleRegistrationDraft } from "@/lib/reception-queue";

export async function GET(request: NextRequest, ctx: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await ctx.params;
  if (!isUuid(draftId)) return NextResponse.json({ error: "Caso inválido." }, { status: 400 });

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const draft = await getSingleRegistrationDraft(session.supabase, draftId);
  if (!draft) return NextResponse.json({ error: "Este caso não foi encontrado." }, { status: 404 });

  const merged = Number(request.nextUrl.searchParams.get("merged"));
  const body = Number.isInteger(merged) && merged > 1 ? { ...draft, mergedDraftsCount: merged } : draft;
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
