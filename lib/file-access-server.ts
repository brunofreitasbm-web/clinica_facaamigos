// lib/file-access-server.ts
//
// Peças compartilhadas pelos route handlers de /api/arquivos/*. Cada rota
// autentica com o client de sessão, deixa a RLS decidir se a linha existe
// para este usuário (vazio = 404, sem revelar se o arquivo existe), gera a
// URL assinada com o client admin, grava o `download` em audit_log e
// responde 302 — o navegador abre PDF/imagem inline numa aba nova a partir
// de um `<a target="_blank">` comum, sem depender de window.open pós-await
// (que o navegador bloqueia como pop-up).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLINIC_DOCUMENTS_BUCKET } from "@/lib/file-access";

// Teto do PRD §11 — nunca aumentar.
export const SIGNED_URL_TTL_SECONDS = 900;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const NO_STORE = { "Cache-Control": "private, no-store" };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Página mínima em português — o link abre em aba nova, então o usuário precisa ler o motivo ali mesmo. */
export function messagePage(status: number, message: string): NextResponse {
  const body = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Arquivo indisponível</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;line-height:1.5"><h1 style="font-size:1.25rem">Não foi possível abrir o arquivo</h1><p>${escapeHtml(message)}</p></body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE },
  });
}

export const notFoundPage = () => messagePage(404, "Arquivo não encontrado ou você não tem acesso a ele.");

export type SessionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

/** Usuário da sessão (cookies) ou a resposta 401 pronta. */
export async function requireSession(): Promise<SessionContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return messagePage(401, "Sessão expirada. Faça login de novo e tente outra vez.");
  return { supabase, userId: user.id };
}

export function getAdmin(): ReturnType<typeof createAdminClient> | NextResponse {
  try {
    return createAdminClient();
  } catch {
    return messagePage(500, "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico.");
  }
}

type AuditInput = {
  tableName: string;
  rowId: string;
  actorId: string;
  clinicId: string | null;
};

/** Registro de download exigido pelo PRD §9.5 — o trigger genérico de audit não cobre leitura. */
export async function logDownload(admin: ReturnType<typeof createAdminClient>, input: AuditInput) {
  const { error } = await admin.from("audit_log").insert({
    table_name: input.tableName,
    row_id: input.rowId,
    action: "download",
    actor_id: input.actorId,
    clinic_id: input.clinicId,
  });
  if (error) console.error("[arquivos] falha ao gravar audit_log de download:", error.message);
}

/** 302 para a URL assinada (TTL 900s) — sem cache, cada abertura gera uma URL nova. */
export async function signedRedirect(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
): Promise<NextResponse | null> {
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return null;
  return new NextResponse(null, {
    status: 302,
    headers: { Location: signed.signedUrl, ...NO_STORE },
  });
}

/**
 * Fluxo padrão das rotas de bucket privado: assina, audita e redireciona.
 * Chamar só depois de o SELECT com o client de sessão ter achado a linha.
 */
export async function respondWithSignedFile(args: {
  userId: string;
  tableName: string;
  rowId: string;
  clinicId: string | null;
  storagePath: string;
  bucket?: string;
}): Promise<NextResponse> {
  const admin = getAdmin();
  if (admin instanceof NextResponse) return admin;

  const redirect = await signedRedirect(admin, args.bucket ?? CLINIC_DOCUMENTS_BUCKET, args.storagePath);
  if (!redirect) {
    return messagePage(404, "O arquivo não está mais disponível no armazenamento.");
  }
  await logDownload(admin, {
    tableName: args.tableName,
    rowId: args.rowId,
    actorId: args.userId,
    clinicId: args.clinicId,
  });
  return redirect;
}

export const inlineHeaders = (mime: string, fileName: string, size: number) => ({
  "Content-Type": mime,
  "Content-Disposition": `inline; filename="${fileName}"`,
  "Content-Length": String(size),
  ...NO_STORE,
});
