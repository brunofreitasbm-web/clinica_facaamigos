"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "@/lib/roles";

type ActionResult = { success: true } | { success: false; error: string };

async function requireCallerIsGestor() {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };

  const { data: callerProfile } = await session
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (callerProfile?.role !== "gestor") {
    return { ok: false as const, error: "Só o gestor pode gerenciar a equipe." };
  }
  return { ok: true as const, clinicId: callerProfile.clinic_id as string };
}

export async function createStaff(formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const councilType = String(formData.get("council_type") ?? "").trim() || null;
  const isEvaluator = formData.get("is_evaluator") === "on";

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
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

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
    clinic_id: caller.clinicId,
    role,
    full_name: fullName,
    council_type: councilType,
    is_evaluator: isEvaluator,
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

export async function updateStaffProfile(
  profileId: string,
  data: { fullName: string; role: Role; councilType?: string | null; isEvaluator?: boolean },
): Promise<ActionResult> {
  if (!data.fullName.trim() || !ROLES.includes(data.role)) {
    return { success: false, error: "Preencha nome e papel." };
  }

  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const session = await createClient();
  const { error } = await session
    .from("profiles")
    .update({
      full_name: data.fullName.trim(),
      role: data.role,
      council_type: data.councilType?.trim() || null,
      is_evaluator: data.isEvaluator ?? false,
    })
    .eq("id", profileId)
    .eq("clinic_id", caller.clinicId);

  if (error) return { success: false, error: "Não foi possível atualizar o colaborador." };

  revalidatePath("/gestor/equipe");
  return { success: true };
}

export async function toggleStaffActive(profileId: string, active: boolean): Promise<ActionResult> {
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const session = await createClient();
  const { error } = await session
    .from("profiles")
    .update({ active })
    .eq("id", profileId)
    .eq("clinic_id", caller.clinicId);

  if (error) return { success: false, error: "Não foi possível alterar o status do colaborador." };

  revalidatePath("/gestor/equipe");
  return { success: true };
}
