// app/api/arquivos/anamnese/[requestId]/[slot]/route.ts
//
// Laudo / guia / carteirinha enviados pelo chatbot de anamnese
// (`anamnesis_scheduling_requests.*_url`). O valor da coluna pode ser:
//  - `storage://clinic-documents/<path>` (padrão novo, bucket privado) →
//    URL assinada;
//  - URL pública legada do bucket `patient-documents` → o path é extraído e
//    lido pelo admin (continua funcionando quando o bucket virar privado).
//    Alguns desses objetos são JPEG gravados com Content-Type
//    application/pdf, que o navegador não abre — então baixamos os bytes,
//    detectamos o tipo real e respondemos nós mesmos (≤ 4MB); acima disso,
//    redireciona para a URL assinada;
//  - qualquer outra coisa (ex.: URL crua do Twilio, que exige autenticação)
//    → 404 com mensagem clara.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ANAMNESIS_SLOT_COLUMN,
  MAX_INLINE_BYTES,
  detectFileType,
  downloadFileName,
  isAnamnesisSlot,
  parseStoredFileRef,
} from "@/lib/file-access";
import {
  getAdmin,
  inlineHeaders,
  isUuid,
  logDownload,
  messagePage,
  notFoundPage,
  requireSession,
  respondWithSignedFile,
  signedRedirect,
} from "@/lib/file-access-server";

const TABLE = "anamnesis_scheduling_requests";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ requestId: string; slot: string }> }) {
  const { requestId, slot } = await ctx.params;
  if (!isUuid(requestId) || !isAnamnesisSlot(slot)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  // A RLS de `anamnesis_scheduling_requests` é permissiva (`using (true)`,
  // 20260906000009) — sozinha deixaria qualquer usuário logado, inclusive a
  // família, ler laudo/guia de qualquer criança. Por isso o portão de papel
  // aqui: só equipe da clínica.
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("role")
    .eq("id", session.userId)
    .maybeSingle();
  if (!profile?.role || profile.role === "responsavel") return notFoundPage();

  const column = ANAMNESIS_SLOT_COLUMN[slot];
  const { data: request } = await session.supabase
    .from(TABLE)
    .select(`id, clinic_id, ${column}`)
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return notFoundPage();

  const rowValue = (request as unknown as Record<string, string | null>)[column];
  const ref = parseStoredFileRef(rowValue);

  if (ref.kind === "unsupported") {
    return messagePage(
      404,
      rowValue
        ? "Este arquivo foi recebido por um link que não pode ser aberto aqui (ainda não foi guardado no armazenamento seguro da clínica). Peça para a família reenviar o documento pelo WhatsApp."
        : "Este documento ainda não foi enviado.",
    );
  }

  if (ref.kind === "private") {
    return respondWithSignedFile({
      userId: session.userId,
      tableName: TABLE,
      rowId: request.id,
      clinicId: request.clinic_id,
      storagePath: ref.path,
      bucket: ref.bucket,
    });
  }

  // Legado (patient-documents): lê pelo admin, sem depender de o bucket ser público.
  const admin = getAdmin();
  if (admin instanceof NextResponse) return admin;

  const { data: blob, error } = await admin.storage.from(ref.bucket).download(ref.path);
  if (error || !blob) {
    return messagePage(404, "O arquivo não está mais disponível no armazenamento.");
  }

  await logDownload(admin, {
    tableName: TABLE,
    rowId: request.id,
    actorId: session.userId,
    clinicId: request.clinic_id,
  });

  if (blob.size > MAX_INLINE_BYTES) {
    const redirect = await signedRedirect(admin, ref.bucket, ref.path);
    return redirect ?? messagePage(404, "O arquivo não está mais disponível no armazenamento.");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const detected = detectFileType(bytes);
  const mime = detected?.mime ?? (blob.type || "application/octet-stream");
  const fileName = downloadFileName(ref.path, detected?.ext ?? null);
  return new NextResponse(bytes, { status: 200, headers: inlineHeaders(mime, fileName, bytes.byteLength) });
}
