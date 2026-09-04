"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { success: true; failedUploads: number } | { success: false; error: string };

const MAX_FILES = 6;
// Mesmo teto de app/recepcao/pacientes/[id]/documents-actions.ts.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo";
}

/**
 * Publica um recado (com fotos opcionais) no mural da família — PRD §4.
 * Mural é independente das evoluções clínicas (decisão confirmada: sem
 * toggle de compartilhamento em session_notes). Segue o mesmo padrão de
 * documents-actions.ts: INSERT do post primeiro pelo client de sessão (RLS
 * feed_posts_insert é o portão real), Storage só depois via admin.
 */
export async function createFeedPost(patientId: string, formData: FormData): Promise<ActionResult> {
  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!body && files.length === 0) {
    return { success: false, error: "Escreva um recado ou anexe pelo menos uma foto." };
  }
  if (files.length > MAX_FILES) {
    return { success: false, error: `No máximo ${MAX_FILES} fotos por post.` };
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { success: false, error: "Uma das fotos é maior que 25MB." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: post, error: postError } = await supabase
    .from("feed_posts")
    .insert({ patient_id: patientId, author_id: user.id, body: body || null })
    .select("id")
    .single();

  if (postError || !post) {
    return { success: false, error: "Você não tem permissão para postar no mural deste paciente." };
  }

  if (files.length === 0) {
    revalidatePath(`/recepcao/pacientes/${patientId}`);
    return { success: true, failedUploads: 0 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Post de texto já está salvo — só as fotos não puderam ser enviadas.
    revalidatePath(`/recepcao/pacientes/${patientId}`);
    return { success: true, failedUploads: files.length };
  }

  let failedUploads = 0;
  for (const file of files) {
    const mediaId = randomUUID();
    const storagePath = `${patientId}/${post.id}/${mediaId}-${sanitizeFileName(file.name)}`;

    const { error: mediaInsertError } = await supabase.from("feed_media").insert({
      id: mediaId,
      post_id: post.id,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
    });
    if (mediaInsertError) {
      failedUploads += 1;
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("family-feed-media")
      .upload(storagePath, arrayBuffer, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      failedUploads += 1;
      await admin.from("feed_media").delete().eq("id", mediaId);
    }
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true, failedUploads };
}
