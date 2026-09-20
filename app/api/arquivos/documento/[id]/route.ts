// app/api/arquivos/documento/[id]/route.ts
//
// Abre um documento do prontuário (tabela `documents`) — mesma regra de
// getDocumentUrl (app/recepcao/pacientes/[id]/documents-actions.ts), mas como
// GET + 302 para funcionar num <a target="_blank"> (ver lib/file-access-server.ts).
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid, notFoundPage, requireSession, respondWithSignedFile } from "@/lib/file-access-server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  // SELECT com o client de sessão: a RLS de `documents` decide. Vazio vale
  // tanto para "não existe" quanto para "sem acesso" — nunca revelamos qual.
  const { data: doc } = await session.supabase
    .from("documents")
    .select("id, storage_path, patients(clinic_id)")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return notFoundPage();

  const patient = Array.isArray(doc.patients) ? doc.patients[0] : doc.patients;
  return respondWithSignedFile({
    userId: session.userId,
    tableName: "documents",
    rowId: doc.id,
    clinicId: patient?.clinic_id ?? null,
    storagePath: doc.storage_path,
  });
}
