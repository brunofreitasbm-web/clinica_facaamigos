// app/api/arquivos/lote/[batchId]/route.ts
//
// PDF original de um lote de acolhimento (`insurance_intake_batches`) — mesma
// regra de getIntakeBatchPdfUrl (app/supervisao/acolhimento-actions.ts), como
// GET + 302.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid, notFoundPage, requireSession, respondWithSignedFile } from "@/lib/file-access-server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  if (!isUuid(batchId)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { data: batch } = await session.supabase
    .from("insurance_intake_batches")
    .select("id, storage_path, clinic_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return notFoundPage();

  return respondWithSignedFile({
    userId: session.userId,
    tableName: "insurance_intake_batches",
    rowId: batch.id,
    clinicId: batch.clinic_id,
    storagePath: batch.storage_path,
  });
}
