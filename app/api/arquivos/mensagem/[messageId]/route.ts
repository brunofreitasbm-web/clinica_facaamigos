// app/api/arquivos/mensagem/[messageId]/route.ts
//
// Anexo de uma mensagem do WhatsApp visto de dentro da conversa da recepção.
//
// `messages.media_url` guarda a URL CRUA do Twilio, que exige Basic Auth e
// portanto devolve 401 no navegador (mesma armadilha documentada em
// /api/arquivos/anamnese). Só que o arquivo já foi baixado e guardado no
// nosso Storage pelo fluxo de ingestão — como `registration_draft_files`
// (telefone desconhecido), `documents` (responsável já cadastrado) ou
// `insurance_intake_lead_files` (bot de acolhimento). Esta rota resolve a URL
// do Twilio para essa cópia e devolve 302 assinado, no mesmo padrão das
// outras rotas de /api/arquivos/*.
//
// Fallback: se nenhuma cópia foi encontrada (mídia que chegou antes do fluxo
// de ingestão existir, ou ingestão que falhou), baixa do Twilio no servidor e
// serve inline. Assim a recepção nunca fica sem ver o que a família mandou.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdmin,
  inlineHeaders,
  isUuid,
  logDownload,
  messagePage,
  notFoundPage,
  requireSession,
  signedRedirect,
} from "@/lib/file-access-server";
import { CLINIC_DOCUMENTS_BUCKET } from "@/lib/file-access";
import { downloadTwilioMedia, extensionFor } from "@/lib/registration-drafts-ingest";

type Resolved = { bucket: string; path: string; tableName: string; rowId: string };

export async function GET(_request: NextRequest, ctx: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await ctx.params;
  if (!isUuid(messageId)) return notFoundPage();

  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  // A RLS de `messages` (messages_read) já decide se esta conversa é desta
  // clínica e se o papel pode lê-la — vazio aqui significa 404 genérico.
  const { data: message } = await session.supabase
    .from("messages")
    .select("id, media_url, conversation_id, patient_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!message?.media_url) return notFoundPage();

  const admin = getAdmin();
  if (admin instanceof NextResponse) return admin;

  const mediaUrl = message.media_url;

  // As três cópias possíveis, na ordem em que o fluxo de ingestão as cria.
  // Tudo com o client admin: a autorização já aconteceu no SELECT acima.
  let resolved: Resolved | null = null;

  const { data: draftFile } = await admin
    .from("registration_draft_files")
    .select("id, storage_path")
    .eq("twilio_media_url", mediaUrl)
    .maybeSingle();
  if (draftFile?.storage_path) {
    resolved = {
      bucket: CLINIC_DOCUMENTS_BUCKET,
      path: draftFile.storage_path,
      tableName: "registration_draft_files",
      rowId: draftFile.id,
    };
  }

  if (!resolved) {
    // `documents.source_key` veio na migration 20260921020000 e ainda não
    // está em lib/database.types.ts — mesmo contorno de lib/whatsapp-lead.ts.
    const { data } = await (admin as unknown as SupabaseClient)
      .from("documents")
      .select("id, storage_path")
      .eq("source_key", mediaUrl)
      .maybeSingle();
    const doc = data as { id: string; storage_path: string } | null;
    if (doc?.storage_path) {
      resolved = { bucket: CLINIC_DOCUMENTS_BUCKET, path: doc.storage_path, tableName: "documents", rowId: doc.id };
    }
  }

  if (!resolved) {
    const { data: intakeFile } = await admin
      .from("insurance_intake_lead_files")
      .select("id, storage_path")
      .eq("twilio_media_url", mediaUrl)
      .maybeSingle();
    if (intakeFile?.storage_path) {
      resolved = {
        bucket: CLINIC_DOCUMENTS_BUCKET,
        path: intakeFile.storage_path,
        tableName: "insurance_intake_lead_files",
        rowId: intakeFile.id,
      };
    }
  }

  if (resolved) {
    const redirect = await signedRedirect(admin, resolved.bucket, resolved.path);
    if (redirect) {
      await logDownload(admin, {
        tableName: resolved.tableName,
        rowId: resolved.rowId,
        actorId: session.userId,
        clinicId: null,
      });
      return redirect;
    }
  }

  // Nenhuma cópia no Storage: busca no Twilio com as credenciais do servidor.
  const downloaded = await downloadTwilioMedia(mediaUrl);
  if (!downloaded) {
    return messagePage(
      404,
      "O anexo não foi encontrado no nosso armazenamento e o Twilio não devolveu o arquivo (a mídia expira lá depois de algum tempo).",
    );
  }

  await logDownload(admin, {
    tableName: "messages",
    rowId: message.id,
    actorId: session.userId,
    clinicId: null,
  });

  return new NextResponse(new Uint8Array(downloaded.buffer), {
    status: 200,
    headers: inlineHeaders(downloaded.mime, `anexo-${messageId}.${extensionFor(downloaded.mime)}`, downloaded.buffer.byteLength),
  });
}
