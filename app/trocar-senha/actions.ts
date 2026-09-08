"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type Role } from "@/lib/roles";

export async function changePassword(
  formData: FormData,
): Promise<{ success: false; error: string } | undefined> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { success: false, error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { success: false, error: "As senhas não conferem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { success: false, error: "Não foi possível trocar a senha. Tente novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id)
    .select("role")
    .maybeSingle();

  const role = profile?.role as Role | undefined;
  redirect(role ? ROLE_HOME[role] : "/login");
}
