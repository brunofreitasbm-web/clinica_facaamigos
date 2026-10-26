"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { isPasswordStrong } from "@/lib/password";
import { CLINIC_NAME } from "@/lib/clinic-identity";

function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}

export type RequestResetResult =
  | { success: true; resetId: string; maskedEmail: string }
  | { success: false; error: string };

export type VerifyResetResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Solicita código de 6 dígitos para redefinir senha ou primeiro acesso.
 */
export async function requestStaffPasswordReset(
  rawIdentifier: string,
): Promise<RequestResetResult> {
  const identifier = String(rawIdentifier ?? "").trim();
  if (!identifier) {
    return { success: false, error: "Informe seu CPF ou e-mail cadastrado." };
  }

  const admin = createAdminClient();
  let query = admin.from("profiles").select("id, full_name, email, cpf, active");

  if (identifier.includes("@")) {
    query = query.eq("email", identifier.toLowerCase());
  } else {
    const digits = identifier.replace(/\D/g, "");
    if (digits.length !== 11) {
      return { success: false, error: "Informe um CPF válido (11 dígitos) ou e-mail." };
    }
    query = query.eq("cpf", digits);
  }

  const { data: profile, error: profErr } = await query.maybeSingle();

  if (profErr || !profile) {
    return {
      success: false,
      error: "Cadastro não encontrado. Verifique seu CPF/e-mail ou fale com a administração.",
    };
  }

  if (profile.active === false) {
    return {
      success: false,
      error: "Seu cadastro está inativo na clínica. Contate a administração.",
    };
  }

  const email = profile.email;
  if (!email || !email.includes("@")) {
    return {
      success: false,
      error: "Nenhum e-mail de contato cadastrado para este perfil. Contate o gestor.",
    };
  }

  // Rate limiting: máx 4 pedidos nos últimos 15 min
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count: recentCount } = await (admin as any)
    .from("staff_password_resets")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", fifteenMinutesAgo);

  if ((recentCount ?? 0) >= 4) {
    return {
      success: false,
      error: "Muitas solicitações recentes. Aguarde 15 minutos antes de tentar novamente.",
    };
  }

  // Código aleatório de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { data: inserted, error: insErr } = await (admin as any)
    .from("staff_password_resets")
    .insert({
      profile_id: profile.id,
      email: email.toLowerCase(),
      code_hash: hashToken(code),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[staff-recovery] Erro ao gravar reset:", insErr);
    return { success: false, error: "Falha ao gerar código. Tente novamente." };
  }

  // Enviar e-mail com Brevo
  const htmlBody = `
<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a3f35;">
  <div style="text-align:center;padding:10px 0 16px;">
    <span style="font-size:18px;font-weight:800;color:#1a3f35;">${CLINIC_NAME}</span>
  </div>
  <div style="background:#fff;border-radius:16px;padding:28px 24px;text-align:center;border:1px solid #edf1ef;">
    <p style="margin:0 0 12px;font-size:15px;color:#1a3f35;">Olá, <strong>${profile.full_name || "Colaborador"}</strong>!</p>
    <p style="margin:0 0 18px;font-size:14px;color:#4C6B62;">Seu código para definir ou redefinir sua senha de acesso ao sistema:</p>
    <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#1a3f35;background:#FFF9F1;border-radius:12px;padding:16px 0;margin:16px 0;">
      ${code}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#8B9A94;">Este código expira em 10 minutos. Se você não fez essa solicitação, ignore este e-mail.</p>
  </div>
</div>`.trim();

  const emailRes = await sendEmail({
    to: email,
    subject: `${code} é seu código de acesso — ${CLINIC_NAME}`,
    html: htmlBody,
  });

  if (!emailRes.success) {
    console.error("[staff-recovery] Falha ao enviar e-mail Brevo:", emailRes.error);
    return {
      success: false,
      error: "Não foi possível enviar o e-mail no momento. Tente novamente em instantes.",
    };
  }

  return {
    success: true,
    resetId: inserted.id,
    maskedEmail: maskEmail(email),
  };
}

/**
 * Valida o código recebido e define a nova senha do colaborador.
 */
export async function verifyStaffPasswordReset(payload: {
  resetId: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<VerifyResetResult> {
  const { resetId, code, newPassword, confirmPassword } = payload;

  if (!resetId || !code) {
    return { success: false, error: "Informe o código de verificação de 6 dígitos." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "As senhas digitadas não conferem." };
  }

  if (!isPasswordStrong(newPassword)) {
    return {
      success: false,
      error: "A senha precisa ter pelo menos 6 caracteres, uma letra maiúscula e um caractere especial.",
    };
  }

  const admin = createAdminClient();

  const { data: resetRecord, error: fetchErr } = await (admin as any)
    .from("staff_password_resets")
    .select("id, profile_id, email, code_hash, attempts, expires_at, used_at")
    .eq("id", resetId)
    .maybeSingle();

  if (fetchErr || !resetRecord) {
    return { success: false, error: "Solicitação expirada ou inválida. Peça um novo código." };
  }

  if (resetRecord.used_at) {
    return { success: false, error: "Este código já foi utilizado. Solicite um novo código." };
  }

  if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
    return { success: false, error: "Este código expirou (limite de 10 minutos). Solicite um novo." };
  }

  if ((resetRecord.attempts ?? 0) >= 5) {
    return {
      success: false,
      error: "Número excessivo de tentativas incorretas. Solicite um novo código.",
    };
  }

  const cleanCode = code.replace(/\D/g, "");
  const codeHash = hashToken(cleanCode);

  if (codeHash !== resetRecord.code_hash) {
    await (admin as any)
      .from("staff_password_resets")
      .update({ attempts: (resetRecord.attempts ?? 0) + 1 })
      .eq("id", resetRecord.id);
    return { success: false, error: "Código incorreto. Confira os 6 dígitos recebidos." };
  }

  // Marcar como utilizado
  await (admin as any)
    .from("staff_password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetRecord.id);

  // Atualizar a senha no Supabase Auth da clínica
  const { error: authErr } = await admin.auth.admin.updateUserById(resetRecord.profile_id, {
    password: newPassword,
  });

  if (authErr) {
    console.error("[staff-recovery] Erro updateUserById:", authErr);
    return { success: false, error: "Erro ao salvar nova senha no sistema de autenticação." };
  }

  // Atualizar must_change_password no profile
  await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", resetRecord.profile_id);

  // Sincronizar com o Hub de Gestão se aplicável
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      await fetch("https://ivjvpdzsfjdpyabbzzuj.supabase.co/functions/v1/gestao-hub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: "atualizar_senha_hub",
          email: resetRecord.email,
          new_password: newPassword,
        }),
      });
    }
  } catch (syncErr) {
    console.warn("[staff-recovery] Sincronização secundária com o Hub falhou (não bloqueante):", syncErr);
  }

  // Fazer login automático da sessão no navegador
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: resetRecord.email,
    password: newPassword,
  });

  if (signInErr) {
    console.warn("[staff-recovery] Auto signInWithPassword falhou:", signInErr.message);
  }

  return { success: true };
}
