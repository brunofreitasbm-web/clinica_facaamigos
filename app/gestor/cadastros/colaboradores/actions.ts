"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "@/lib/roles";
import { isPasswordStrong } from "@/lib/password";

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

// `unit_id` veio herdado do webhook do sistema de gestão de pessoas (Grupo IB),
// que opera múltiplas unidades. Esta clínica só tem uma — não faz sentido
// perguntar isso no cadastro, então todo colaborador cai automaticamente na
// única unidade existente.
async function getDefaultUnitId(supabase: { from: (table: string) => any }): Promise<string | null> {
  const { data } = await supabase.from("units").select("id").order("name").limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function createStaff(formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const cpfDigits = String(formData.get("cpf") ?? "").replace(/\D/g, "");
  const emailInput = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const councilType = String(formData.get("council_type") ?? "").trim() || null;
  const isEvaluator = formData.get("is_evaluator") === "on";
  const isAtProfessional = formData.get("is_at_professional") === "on";
  const birthDate = parseDateInput(formData.get("birth_date"));

  if (!fullName || cpfDigits.length !== 11 || !password || !ROLES.includes(role)) {
    return { success: false, error: "Preencha nome, CPF (11 dígitos), senha e papel." };
  }
  if (!isPasswordStrong(password)) {
    return {
      success: false,
      error: "Senha precisa ter pelo menos 6 caracteres, uma letra maiúscula e um caractere especial.",
    };
  }

  // Login é sempre por CPF; e-mail é opcional (nem todo colaborador tem um).
  // Sem e-mail real, o Supabase Auth ainda exige um endereço pra criar a
  // conta — geramos um sintético que o colaborador nunca vê nem digita,
  // mesma ideia já usada no login por telefone/OTP da família.
  const email = emailInput || `equipe_${cpfDigits}@staff.facaamigos.local`;

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

  const unitId = await getDefaultUnitId(admin);

  const { error: profileError } = await admin.from("profiles").insert({
    id: newUser.user.id,
    clinic_id: caller.clinicId,
    role,
    full_name: fullName,
    cpf: cpfDigits,
    council_type: councilType,
    is_evaluator: isEvaluator,
    is_at_professional: isAtProfessional,
    email,
    birth_date: birthDate,
    unit_id: unitId,
  });

  if (profileError) {
    // Reverte a conta criada no Auth pra não deixar um usuário órfão sem
    // profile (não consegue logar em lugar nenhum do app mesmo assim, mas
    // fica um lixo silencioso na base de auth caso o gestor tente de novo).
    await admin.auth.admin.deleteUser(newUser.user.id);
    const isCpfDuplicate =
      profileError.code === "23505" ||
      profileError.message.includes("profiles_cpf_unique") ||
      profileError.message.toLowerCase().includes("cpf");

    const detailMsg = [profileError.message, profileError.details, profileError.hint]
      .filter(Boolean)
      .join(" - ");

    return {
      success: false,
      error: isCpfDuplicate
        ? "Já existe um colaborador cadastrado com este CPF."
        : `Não foi possível salvar o perfil da conta: ${detailMsg || "Erro no banco de dados."}`,
    };
  }

  revalidatePath("/gestor/cadastros/colaboradores");
  return { success: true };
}

export async function updateStaffProfile(
  profileId: string,
  data: {
    fullName: string;
    role: Role;
    cpf?: string | null;
    councilType?: string | null;
    isEvaluator?: boolean;
    isAtProfessional?: boolean;
    googleCalendarOptIn?: boolean;
    birthDate?: string | null;
  },
): Promise<ActionResult> {
  if (!data.fullName.trim() || !ROLES.includes(data.role)) {
    return { success: false, error: "Preencha nome e papel." };
  }

  const cpfDigits = data.cpf?.replace(/\D/g, "") || null;
  if (cpfDigits && cpfDigits.length !== 11) {
    return { success: false, error: "CPF precisa ter 11 dígitos." };
  }

  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  const session = await createClient();
  const unitId = await getDefaultUnitId(session);
  const { error } = await session
    .from("profiles")
    .update({
      full_name: data.fullName.trim(),
      role: data.role,
      cpf: cpfDigits,
      council_type: data.councilType?.trim() || null,
      is_evaluator: data.isEvaluator ?? false,
      is_at_professional: data.isAtProfessional ?? false,
      google_calendar_opt_in: data.googleCalendarOptIn ?? false,
      birth_date: data.birthDate?.trim() || null,
      unit_id: unitId,
    })
    .eq("id", profileId)
    .eq("clinic_id", caller.clinicId);

  if (error) {
    return {
      success: false,
      error: error.message.includes("profiles_cpf_unique")
        ? "Já existe um colaborador com esse CPF."
        : "Não foi possível atualizar o colaborador.",
    };
  }

  revalidatePath("/gestor/cadastros/colaboradores");
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

  revalidatePath("/gestor/cadastros/colaboradores");
  return { success: true };
}

export async function deleteStaff(profileId: string): Promise<ActionResult> {
  const caller = await requireCallerIsGestor();
  if (!caller.ok) return { success: false, error: caller.error };

  if (profileId === caller.actorId) {
    return { success: false, error: "Você não pode excluir o seu próprio usuário de gestor." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada.",
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("clinic_id", caller.clinicId);

  if (profileError) {
    return { success: false, error: `Não foi possível excluir o colaborador: ${profileError.message}` };
  }

  try {
    await admin.auth.admin.deleteUser(profileId);
  } catch {
    // se o user já não existia no auth, prossegue
  }

  revalidatePath("/gestor/cadastros/colaboradores");
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

  revalidatePath("/gestor/cadastros/colaboradores");
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

  revalidatePath("/gestor/cadastros/colaboradores");
  revalidatePath("/terapeuta");
  return { success: true };
}
