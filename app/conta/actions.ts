"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_UPLOAD_MIMES, sniffAllowed } from "@/lib/upload-bytes";
import { isPasswordStrong } from "@/lib/password";
import { normalizeCpfDigits, normalizeEmail } from "@/lib/whatsapp-lead-pure";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type ContaResult = { success: true } | { success: false; error: string };

/**
 * Foto do próprio operador (menu do usuário na barra do módulo). Caminho
 * fixo `${userId}/avatar` com upsert: troca a foto sem deixar arquivo órfão.
 * O UPDATE em profiles usa o client de sessão — profiles_self_update já
 * restringe o usuário à própria linha e mantém role/clínica intactos.
 */
export async function uploadOwnAvatar(formData: FormData): Promise<ContaResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selecione uma imagem." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: "Imagem maior que 5MB." };
  }

  // Tipo real pelos bytes (o path é fixo, sem extensão).
  const bytes = await file.arrayBuffer();
  const sniffed = sniffAllowed(new Uint8Array(bytes), IMAGE_UPLOAD_MIMES);
  if (!sniffed || sniffed.mime === "image/gif") {
    return { success: false, error: "Envie um arquivo de imagem (JPG, PNG ou WEBP)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { success: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico." };
  }

  const storagePath = `${user.id}/avatar`;
  const { error: uploadError } = await admin.storage
    .from("profile-avatars")
    .upload(storagePath, bytes, { contentType: sniffed.mime, upsert: true });
  if (uploadError) return { success: false, error: "Não foi possível enviar a foto. Tente de novo." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_storage_path: storagePath })
    .eq("id", user.id);
  if (updateError) return { success: false, error: "Foto enviada, mas não foi possível salvar no seu perfil." };

  revalidatePath("/", "layout");
  return { success: true };
}

export type OwnProfile = {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string;
};

/** Dados cadastrais do próprio operador, para o diálogo "Meu cadastro". */
export async function getOwnProfile(): Promise<{ success: true; profile: OwnProfile } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, cpf, email, phone, birth_date")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return { success: false, error: "Não foi possível carregar seu cadastro." };

  return {
    success: true,
    profile: {
      fullName: data.full_name ?? "",
      cpf: data.cpf ?? "",
      email: data.email ?? user.email ?? "",
      phone: data.phone ?? "",
      birthDate: data.birth_date ?? "",
    },
  };
}

/**
 * Salva o cadastro do próprio operador. Só toca nos campos pessoais; role,
 * clínica e flags ficam protegidos por profiles_self_update. CPF vai só com
 * dígitos (formato já usado em profiles).
 */
export async function saveOwnProfile(formData: FormData): Promise<ContaResult> {
  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const cpfRaw = String(formData.get("cpf") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();

  if (fullName.split(" ").length < 2) return { success: false, error: "Informe seu nome completo." };

  const cpf = cpfRaw ? normalizeCpfDigits(cpfRaw) : null;
  if (cpfRaw && !cpf) return { success: false, error: "CPF inválido." };

  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) return { success: false, error: "E-mail inválido." };

  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && phoneDigits.length < 10) return { success: false, error: "Telefone inválido (use DDD + número)." };

  if (birthDate) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && !Number.isNaN(Date.parse(birthDate));
    if (!valid || birthDate < "1900-01-01" || birthDate > new Date().toISOString().slice(0, 10)) {
      return { success: false, error: "Data de nascimento inválida." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      cpf,
      email,
      phone: phoneDigits || null,
      birth_date: birthDate || null,
    })
    .eq("id", user.id);
  if (error) {
    return {
      success: false,
      error: error.message.includes("profiles_cpf_unique")
        ? "Este CPF já está cadastrado em outro usuário."
        : "Não foi possível salvar seu cadastro. Tente novamente.",
    };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Troca de senha pelo menu do usuário (sem redirecionamento, diferente de
 * app/trocar-senha, que é o fluxo de troca obrigatória no primeiro acesso).
 * Mesmas regras de força de isPasswordStrong.
 */
export async function changeOwnPassword(formData: FormData): Promise<ContaResult> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isPasswordStrong(password)) {
    return {
      success: false,
      error: "A senha precisa ter pelo menos 6 caracteres, uma letra maiúscula e um caractere especial.",
    };
  }
  if (password !== confirmPassword) return { success: false, error: "As senhas não conferem." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { success: false, error: "Não foi possível trocar a senha. Tente novamente." };

  return { success: true };
}
