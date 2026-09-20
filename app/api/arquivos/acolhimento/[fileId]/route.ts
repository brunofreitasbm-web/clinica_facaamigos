// app/api/arquivos/acolhimento/[fileId]/route.ts
//
// Arquivo de um lead de acolhimento (`insurance_intake_lead_files`) — mesma
// regra de getIntakeFileUrl (app/supervisao/acolhimento-actions.ts), como
// GET + 302. A RLS da tabela (recepção/supervisão/gestor da clínica) decide.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isUuid, notFoundPage, requireSession, respondWithSignedFile } from "@/lib/file-access-server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  if (!isUuid(fileId)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { data: file } = await session.supabase
    .from("insurance_intake_lead_files")
    .select("id, storage_path, lead_id, insurance_intake_leads(clinic_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return notFoundPage();

  const lead = Array.isArray(file.insurance_intake_leads) ? file.insurance_intake_leads[0] : file.insurance_intake_leads;
  return respondWithSignedFile({
    userId: session.userId,
    tableName: "insurance_intake_lead_files",
    rowId: file.id,
    clinicId: lead?.clinic_id ?? null,
    storagePath: file.storage_path,
  });
}
