// app/recepcao/pacientes/[id]/documents-actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

type ActionResult = { success: true } | { success: false; error: string };
type UrlResult = { success: true; url: string } | { success: false; error: string };

// Mesmo limite do bucket `clinic-documents` (25MB, já configurado no Storage).
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// Teto do PRD §11 — nunca aumentar.
const SIGNED_URL_TTL_SECONDS = 900;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "arquivo";
}

/**
 * Remove a linha de `documents` criada nesta mesma requisição quando o
 * upload pro Storage falha depois do insert (compensação). Usa o client
 * admin porque `documents` não tem policy de DELETE pra nenhum papel — o
 * client de sessão simplesmente não apagaria nada (RLS filtra silenciosamente,
 * sem erro). Não é um novo bypass de decisão de acesso: a linha só existe
 * porque a RLS já aprovou o INSERT segundos antes, nesta mesma chamada.
 */
async function rollbackInsertedDocument(documentId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("documents").delete().eq("id", documentId);
  } catch {
    // Se nem o admin client estiver configurado, não há como reverter — o
    // erro principal (upload falhou) já é retornado ao usuário de qualquer
    // forma; a linha órfã fica para limpeza manual.
  }
}

export async function uploadDocument(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!patientId) return { success: false, error: "Paciente inválido." };

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "");
  const validUntilRaw = String(formData.get("valid_until") ?? "").trim();
  const sharedWithFamily = formData.get("shared_with_family") === "on";

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione um arquivo." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 25MB — não é possível enviar." };
  }
  if (!DOCUMENT_CATEGORIES.some((c) => c.value === category)) {
    return { success: false, error: "Selecione uma categoria válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  // O caminho no Storage já embute o id do documento, então geramos o id
  // na aplicação (em vez de deixar o banco gerar) — permite montar
  // `storage_path` e inserir tudo de uma vez, sem um UPDATE posterior (que
  // exigiria uma policy de UPDATE que o terapeuta não tem em `documents`).
  const documentId = randomUUID();
  const storagePath = `${patientId}/${documentId}/${sanitizeFileName(file.name)}`;

  // 1) INSERT primeiro, com o client de sessão: a RLS de `documents` é o
  // portão real. Se este usuário não puder anexar documento a este
  // paciente, a action falha aqui — nada toca o Storage.
  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    patient_id: patientId,
    category,
    storage_path: storagePath,
    uploaded_by: user.id,
    valid_until: validUntilRaw || null,
    shared_with_family: sharedWithFamily,
  });

  if (insertError) {
    return {
      success: false,
      error: "Você não tem permissão para anexar documentos a este paciente.",
    };
  }

  // 2) Só depois do insert confirmado, o client admin sobe o arquivo pro
  // bucket privado (sem policy de Storage — só service-role acessa).
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await rollbackInsertedDocument(documentId);
    return {
      success: false,
      error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from("clinic-documents")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    await rollbackInsertedDocument(documentId);
    return { success: false, error: "Não foi possível enviar o arquivo. Tente de novo." };
  }

  revalidatePath(`/recepcao/pacientes/${patientId}`);
  return { success: true };
}

export async function getDocumentUrl(documentId: string): Promise<UrlResult> {
  if (!documentId) return { success: false, error: "Documento inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login de novo." };
  }

  // 1) SELECT primeiro, com o client de sessão: se a RLS bloquear (usuário
  // sem acesso a este documento) ou o documento não existir, o resultado
  // vem vazio nos dois casos — nunca revelamos qual dos dois foi.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, patients(clinic_id)")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) {
    return { success: false, error: "Documento não encontrado." };
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
    .from("clinic-documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    return { success: false, error: "Não foi possível gerar o link do documento. Tente de novo." };
  }

  // Registro de download exigido pelo PRD §9.5 — o trigger genérico de
  // audit só cobre INSERT/UPDATE/DELETE de tabela, não leitura, por isso
  // este insert manual em `audit_log`.
  const clinicId = (doc.patients as { clinic_id: string } | null)?.clinic_id ?? null;
  await admin.from("audit_log").insert({
    table_name: "documents",
    row_id: doc.id,
    action: "download",
    actor_id: user.id,
    clinic_id: clinicId,
  });

  return { success: true, url: signed.signedUrl };
}
