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
  return { ok: true as const, clinicId: callerProfile.clinic_id as string, actorId: user.id };
}

// Data vinda de <input type="date"> já chega em ISO (yyyy-mm-dd); campo vazio
// vira null pra não gravar string vazia numa coluna `date`.
function parseDateInput(value: FormDataEntryValue | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function createStaff(formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const councilType = String(formData.get("council_type") ?? "").trim() || null;
  const isEvaluator = formData.get("is_evaluator") === "on";
  const birthDate = parseDateInput(formData.get("birth_date"));
  const unitId = String(formData.get("unit_id") ?? "").trim() || null;

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
    email,
    birth_date: birthDate,
    unit_id: unitId,
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
  data: {
    fullName: string;
    role: Role;
    councilType?: string | null;
    isEvaluator?: boolean;
    birthDate?: string | null;
    unitId?: string | null;
  },
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
      birth_date: data.birthDate?.trim() || null,
      unit_id: data.unitId?.trim() || null,
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

// ---------------------------------------------------------------------------
// Reset de credenciais (senha de login e PIN de assinatura)
// ---------------------------------------------------------------------------

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I): a senha temporária é lida em
// voz alta ou digitada à mão pela recepção antes do primeiro login.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function buildTempPassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join("") + "@9";
}

type ResetPasswordResult =
  | { success: true; tempPassword: string }
  | { success: false; error: string };

/**
 * Gera uma senha temporária e marca `must_change_password`, que o middleware
 * (`lib/supabase/middleware.ts`) usa pra empurrar o usuário direto pra
 * /trocar-senha no próximo login. A senha só é devolvida pra tela do gestor —
 * nunca vai pro audit_log.
 */
export async function resetStaffPassword(profileId: string): Promise<ResetPasswordResult> {
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

  // Confere que o alvo é da mesma clínica antes de tocar no Auth: o admin
  // client ignora RLS, então a checagem de escopo precisa ser explícita.
  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, clinic_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!target || target.clinic_id !== caller.clinicId) {
    return { success: false, error: "Colaborador não encontrado nesta clínica." };
  }

  const tempPassword = buildTempPassword();
  const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
    password: tempPassword,
  });
  if (authError) {
    return { success: false, error: "Não foi possível redefinir a senha no login." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profileId);

  if (profileError) {
    // A senha já foi trocada no Auth; sem a flag o usuário entra e continua com
    // a temporária, então isso precisa aparecer pro gestor, não passar batido.
    return {
      success: false,
      error: "Senha redefinida, mas não foi possível exigir a troca no próximo login. Avise o time técnico.",
    };
  }

  await admin.from("audit_log").insert({
    table_name: "profiles",
    row_id: profileId,
    action: "staff_password_reset",
    actor_id: caller.actorId,
    clinic_id: caller.clinicId,
    after: { must_change_password: true },
  });

  revalidatePath("/gestor/equipe");
  return { success: true, tempPassword };
}

/**
 * Zera o PIN de assinatura (e o bloqueio por tentativas erradas). Na próxima
 * evolução o terapeuta cai no fluxo de cadastrar PIN de novo — o PIN nunca é
 * recuperável, só redefinível pelo próprio dono.
 */
export async function resetSignaturePin(profileId: string): Promise<ActionResult> {
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const session = await createClient();
  const { error } = await session
    .from("profiles")
    .update({
      signature_pin_hash: null,
      signature_pin_updated_at: null,
      signature_pin_failed_attempts: 0,
      signature_pin_locked_until: null,
    })
    .eq("id", profileId)
    .eq("clinic_id", caller.clinicId);

  if (error) return { success: false, error: "Não foi possível resetar o PIN de assinatura." };

  // Rastro é desejável, mas depende do service role: se ele faltar, o reset em
  // si já aconteceu e não deve ser desfeito por causa do log.
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      table_name: "profiles",
      row_id: profileId,
      action: "staff_signature_pin_reset",
      actor_id: caller.actorId,
      clinic_id: caller.clinicId,
      after: { signature_pin_hash: null },
    });
  } catch {
    // sem service role configurada — segue sem log
  }

  revalidatePath("/gestor/equipe");
  revalidatePath("/terapeuta");
  return { success: true };
}
