"use server";

// Assinatura de quem emite os documentos da recepção. Cada pessoa só envia e
// remove a PRÓPRIA assinatura (o id vem da sessão, nunca do formulário). A
// imagem fica no bucket privado clinic-documents — o repositório é público e
// assinatura não pode ir para o código. Coluna: profiles.signature_path
// (supabase/migrations/20261118120000_profiles_signature.sql).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffAllowed } from "@/lib/upload-bytes";
import { inkAlpha, inkBounds } from "@/lib/signature-image-pure";

const BUCKET = "clinic-documents";
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 900;
const SIGNATURE_MIMES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"]);
const PAGE = "/recepcao/documentos";

type Fail = { success: false; error: string };

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Foto ou escaneamento da assinatura → PNG só com a tinta, fundo transparente, recortado. */
async function toTransparentSignature(input: Uint8Array): Promise<Buffer | null> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .normalise()
    .median(3) // tira pontinhos soltos e o chiado de JPEG em volta do traço
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = inkAlpha(data[i * info.channels]);

  const box = inkBounds(alpha, width, height, Math.round(Math.max(width, height) * 0.01) + 4);
  if (!box) return null;

  const rgba = Buffer.alloc(width * height * 4); // tinta preta (0,0,0) + alpha
  for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract(box)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function uploadMySignature(formData: FormData): Promise<{ success: true } | Fail> {
  const user = await sessionUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Escolha a foto ou o escaneamento da assinatura." };
  if (file.size > MAX_BYTES) return { success: false, error: "Arquivo grande demais (máximo 8 MB)." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffAllowed(bytes, SIGNATURE_MIMES)) {
    return { success: false, error: "Envie uma foto ou imagem (JPG ou PNG) da assinatura. PDF não é aceito aqui." };
  }

  let png: Buffer | null;
  try {
    png = await toTransparentSignature(bytes);
  } catch {
    return { success: false, error: "Não consegui ler a imagem. Tente outra foto da assinatura." };
  }
  if (!png) return { success: false, error: "Não encontrei a assinatura na imagem. Use caneta escura em papel branco." };

  const admin = createAdminClient();
  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("clinic_id, signature_path")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) {
    return { success: false, error: "A assinatura ainda não foi ativada no sistema. Avise o responsável pelo sistema." };
  }
  if (!profile) return { success: false, error: "Perfil não encontrado." };

  const path = `${profile.clinic_id}/signatures/${user.id}/${Date.now()}.png`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
  if (uploadError) return { success: false, error: "Não foi possível salvar a assinatura. Tente de novo." };

  const { error: updateError } = await admin.from("profiles").update({ signature_path: path }).eq("id", user.id);
  if (updateError) {
    await admin.storage.from(BUCKET).remove([path]);
    return { success: false, error: "Não foi possível salvar a assinatura. Tente de novo." };
  }
  const old = (profile as { signature_path?: string | null }).signature_path;
  if (old && old !== path) await admin.storage.from(BUCKET).remove([old]);

  revalidatePath(PAGE);
  return { success: true };
}

export async function removeMySignature(): Promise<{ success: true } | Fail> {
  const user = await sessionUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("signature_path").eq("id", user.id).maybeSingle();
  const old = (profile as { signature_path?: string | null } | null)?.signature_path;
  const { error } = await admin.from("profiles").update({ signature_path: null }).eq("id", user.id);
  if (error) return { success: false, error: "Não foi possível remover. Tente de novo." };
  if (old) await admin.storage.from(BUCKET).remove([old]);

  revalidatePath(PAGE);
  return { success: true };
}
