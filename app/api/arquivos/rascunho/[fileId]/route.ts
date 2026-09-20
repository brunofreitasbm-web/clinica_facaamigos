// app/api/arquivos/rascunho/[fileId]/route.ts
//
// Arquivo de um pré-cadastro (`registration_draft_files`) — mesma regra de
// getDraftFileUrl (app/recepcao/pre-cadastros/actions.ts), como GET + 302.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid, notFoundPage, requireSession, respondWithSignedFile } from "@/lib/file-access-server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  if (!isUuid(fileId)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { data: file } = await session.supabase
    .from("registration_draft_files")
    .select("id, storage_path, draft_id, registration_drafts(clinic_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return notFoundPage();

  const draft = Array.isArray(file.registration_drafts) ? file.registration_drafts[0] : file.registration_drafts;
  return respondWithSignedFile({
    userId: session.userId,
    tableName: "registration_draft_files",
    rowId: file.id,
    clinicId: draft?.clinic_id ?? null,
    storagePath: file.storage_path,
  });
}
