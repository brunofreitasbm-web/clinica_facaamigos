// app/terapeuta/evolucao/[appointmentId]/media-actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UploadResult = { success: true; mediaId: string } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };

// Mesmo teto do bucket `session-note-media` (25MB).
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 900;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo";
}

/**
 * Anexo de foto/vídeo à evolução (PRD §9.4 item "anexar foto/vídeo curto").
 * Mesmo padrão insert→upload→compensar de
 * app/recepcao/pacientes/[id]/documents-actions.ts::uploadDocument: o INSERT
 * primeiro, com o client de sessão, é o portão real (RLS de
 * session_note_media_insert + o trigger de consentimento de imagem); o
 * upload em si usa o client admin porque o bucket não tem policy de Storage.
 */
export async function uploadSessionNoteMedia(
  appointmentId: string,
  patientId: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!appointmentId || !patientId) {
    return { success: false, error: "Sessão inválida." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione um arquivo." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 25MB — não é possível enviar." };
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return { success: false, error: "Só é possível anexar foto ou vídeo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  const mediaId = randomUUID();
  const storagePath = `${patientId}/${appointmentId}/${mediaId}/${sanitizeFileName(file.name)}`;

  // 1) INSERT primeiro com o client de sessão: session_note_media_insert
  // (RLS) exige uploaded_by = auth.uid() e que o terapeuta seja o dono do
  // appointment; o trigger session_note_media_image_consent recusa se
  // qualquer responsável revogou o consentimento de imagem. Se qualquer uma
  // dessas condições falhar, a linha nem chega a existir.
  const { data: inserted, error: insertError } = await supabase
    .from("session_note_media")
    .insert({
      id: mediaId,
      appointment_id: appointmentId,
      patient_id: patientId,
      uploaded_by: user.id,
      storage_path: storagePath,
      mime_type: file.type,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    // O trigger de consentimento devolve uma mensagem amigável em
    // pt-BR via RAISE EXCEPTION — repassamos o texto quando disponível.
    const message = insertError?.message?.includes("consentimento de uso de imagem")
      ? insertError.message
      : "Não foi possível anexar o arquivo a esta sessão.";
    return { success: false, error: message };
  }

  // 2) Só depois do insert confirmado, o client admin sobe o arquivo.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await supabase.from("session_note_media").delete().eq("id", mediaId);
    return {
      success: false,
      error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from("session-note-media")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // session_note_media não tem policy de DELETE pra nenhum papel (mesmo
    // append-only de session_notes) — a compensação usa o admin client,
    // igual a rollbackInsertedDocument em documents-actions.ts.
    await admin.from("session_note_media").delete().eq("id", mediaId);
    return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
  }

  return { success: true, mediaId };
}

export async function getSessionNoteMediaUrl(mediaId: string): Promise<UrlResult> {
  if (!mediaId) return { success: false, error: "Anexo inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  // SELECT com o client de sessão — a RLS (session_note_media_read) é o
  // portão real; vazio cobre tanto "não existe" quanto "sem acesso".
  const { data: media } = await supabase
    .from("session_note_media")
    .select("id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();

  if (!media) {
    return { success: false, error: "Anexo não encontrado." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
    };
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("session-note-media")
    .createSignedUrl(media.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    return { success: false, error: "Não foi possível gerar o link do anexo. Tente de novo." };
  }

  return { success: true, url: signed.signedUrl };
}
