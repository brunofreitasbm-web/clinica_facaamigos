"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "@/lib/roles";

export async function createStaff(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!fullName || !email || !password || !ROLES.includes(role)) {
    return { success: false, error: "Preencha nome, e-mail, senha e papel." };
  }
  if (password.length < 8) {
    return { success: false, error: "Senha precisa ter pelo menos 8 caracteres." };
  }

  // A RLS de `profiles` não tem policy de INSERT (só self/admin update e
  // read por clínica) — criar conta é sempre um bypass deliberado, então a
  // checagem de "quem pode chamar isto" precisa vir da aplicação, não do
  // banco. Sem isso, qualquer server action autenticado poderia criar
  // perfis com qualquer role.
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada." };

  const { data: callerProfile } = await session
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (callerProfile?.role !== "gestor") {
    return { success: false, error: "Só o gestor pode cadastrar equipe." };
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

  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !newUser.user) {
    return {
      success: false,
      error: createUserError?.message.includes("already been registered")
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta.",
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: newUser.user.id,
    clinic_id: callerProfile.clinic_id,
    role,
    full_name: fullName,
  });

  if (profileError) {
    // Reverte a conta criada no Auth pra não deixar um usuário órfão sem
    // profile (não consegue logar em lugar nenhum do app mesmo assim, mas
    // fica um lixo silencioso na base de auth caso o gestor tente de novo).
    await admin.auth.admin.deleteUser(newUser.user.id);
    return { success: false, error: "Não foi possível salvar o perfil da conta." };
  }

  revalidatePath("/gestor/equipe");
  return { success: true };
}
