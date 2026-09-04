"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const DEMO_ROLES: Record<string, string> = {
  "gestor@facaamigos.com.br": "gestor",
  "supervisor@facaamigos.com.br": "supervisor",
  "terapeuta@facaamigos.com.br": "terapeuta",
  "recepcao@facaamigos.com.br": "recepcao",
  "faturamento@facaamigos.com.br": "faturamento",
};

export async function signIn(
  formData: FormData,
): Promise<{ success: false; error: string } | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { success: false, error: "Preencha e-mail e senha." };
  }

  const isPlaceholderKey =
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "placeholder";

  if (!isPlaceholderKey) {
    let signInError = true;
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      signInError = Boolean(error);
    } catch {
      // Se falhar o cliente Supabase, tenta o modo demo abaixo
    }
    if (!signInError) {
      redirect("/");
    }
  }

  // Modo Demo Local (Senha padrão facaamigos123 ou aceita qualquer e-mail no modo demo)
  if (password === "facaamigos123" || isPlaceholderKey) {
    const role = DEMO_ROLES[email] || "gestor";
    const cookieStore = await cookies();
    cookieStore.set("demo_user_role", role, { path: "/", httpOnly: true });
    cookieStore.set("demo_user_email", email, { path: "/", httpOnly: true });
    redirect("/");
  }

  return { success: false, error: "E-mail ou senha inválidos." };
}

export async function switchDemoRole(role: string, targetPath: string) {
  const cookieStore = await cookies();
  cookieStore.set("demo_user_role", role, { path: "/", httpOnly: true });
  cookieStore.set("demo_user_email", `${role}@facaamigos.com.br`, { path: "/", httpOnly: true });
  redirect(targetPath);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("demo_user_role");
  cookieStore.delete("demo_user_email");

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // noop
  }
  redirect("/login");
}

