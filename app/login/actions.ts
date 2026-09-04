"use server";

import { createClient } from "@/lib/supabase/server";

const ROLE_HOME: Record<string, string> = {
  gestor: "/gestor",
  supervisor: "/supervisao",
  terapeuta: "/terapeuta",
  recepcao: "/recepcao",
  faturamento: "/faturamento",
};

export async function login(
  formData: FormData,
): Promise<{ success: true; redirectTo: string } | { success: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { success: false, error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { success: false, error: "E-mail ou senha incorretos." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { success: false, error: "Conta sem perfil de equipe vinculado. Fale com a coordenação." };
  }

  const redirectTo = ROLE_HOME[profile.role];
  if (!redirectTo) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "Este login é só para a equipe. Responsáveis entram pelo portal da família.",
    };
  }

  return { success: true, redirectTo };
}
