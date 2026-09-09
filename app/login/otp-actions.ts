"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTwilioSMS, isTwilioConfigured, getTwilioContentSidForCategory } from "@/lib/twilio";

interface FamilyOtpRecord {
  id: string;
  phone: string;
  code: string;
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at?: string;
}

function normalizeDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o código de país para normalizar busca local
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Solicita envio de código OTP para telefone de um responsável cadastrado.
 */
export async function requestFamilyOtp(
  rawPhone: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  const digits = normalizeDigits(rawPhone);

  if (!digits || digits.length < 10) {
    return {
      success: false,
      error: "Informe um número de telefone ou celular válido com DDD.",
    };
  }

  const admin = createAdminClient();

  // Buscar todos os responsáveis cadastrados na clínica
  const { data: guardians, error: gError } = await admin
    .from("guardians")
    .select("id, patient_id, profile_id, full_name, phone, email");

  if (gError) {
    console.error("Erro ao buscar responsáveis:", gError);
    return { success: false, error: "Erro interno ao buscar cadastro. Tente novamente." };
  }

  // Filtrar responsáveis que coincidem com o número informado
  const matchingGuardian = (guardians ?? []).find(
    (g) => normalizeDigits(g.phone) === digits,
  );

  if (!matchingGuardian) {
    // Também verificar na tabela de profiles por segurança
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, phone, full_name")
      .eq("role", "responsavel");

    const matchingProfile = (profiles ?? []).find(
      (p) => p.phone && normalizeDigits(p.phone) === digits,
    );

    if (!matchingProfile) {
      return {
        success: false,
        error:
          "Telefone não encontrado no cadastro de responsáveis da clínica. Entre em contato com a recepção para cadastrar seu número.",
      };
    }
  }

  // Gerar código numérico aleatório de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos

  // Inserir registro de OTP no banco
  const { error: insertError } = await admin.from("family_otp_codes").insert({
    phone: digits,
    code,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("Erro ao salvar código OTP:", insertError);
    return { success: false, error: "Falha ao gerar código OTP. Tente novamente." };
  }

  // Envio real via SMS quando o Twilio está configurado — em dev/sem
  // credenciais, isTwilioConfigured() é false e o console.log abaixo é o
  // único "envio". Só loga o código em texto claro nesse caso (sem Twilio
  // configurado não é produção); com Twilio ativo o código nunca vai pro
  // log do servidor.
  if (!isTwilioConfigured()) {
    console.log(`[OTP FAMÍLIA] Código gerado para o telefone ${digits}: ${code}`);
  }

  if (isTwilioConfigured()) {
    const messageText = `Seu código de acesso ao Portal da Família FaçaAmigos é: ${code}\n\nEle expira em 5 minutos. Não compartilhe este código.`;
    const contentSid = getTwilioContentSidForCategory("otp");
    await sendTwilioSMS({ 
      to: digits, 
      message: messageText,
      ...(contentSid ? { contentSid, contentVariables: { "1": "FaçaAmigos", "2": code } } : {})
    });
  }

  return {
    success: true,
    message: "Código de verificação enviado! Digite os 6 dígitos para continuar.",
  };
}

/**
 * Valida o código OTP e efetua o login da sessão do responsável.
 */
export async function verifyFamilyOtp(
  rawPhone: string,
  code: string,
  cpf?: string,
): Promise<{ success: boolean; error?: string; requiresCpf?: boolean }> {
  const digits = normalizeDigits(rawPhone);
  const cleanCode = code.trim();

  if (!digits || cleanCode.length !== 6) {
    return { success: false, error: "Preencha o telefone e o código de 6 dígitos." };
  }

  const admin = createAdminClient();

  // Buscar último OTP ativo para o número
  const { data: otpRecords, error: otpError } = await admin
    .from("family_otp_codes")
    .select("*")
    .eq("phone", digits)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (otpError || !otpRecords || (otpRecords as FamilyOtpRecord[]).length === 0) {
    return {
      success: false,
      error: "Nenhum código ativo encontrado. Solicite um novo código.",
    };
  }

  const otp = (otpRecords as FamilyOtpRecord[])[0];

  // Checar expiração ou limite de tentativas
  if (new Date(otp.expires_at) < new Date() || otp.attempts >= 3) {
    return {
      success: false,
      error: "Código expirado ou limite de tentativas excedido. Solicite um novo código.",
    };
  }

  // Validar o código digitado
  if (otp.code !== cleanCode) {
    await admin
      .from("family_otp_codes")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);

    return {
      success: false,
      error: `Código incorreto. Tentativa ${otp.attempts + 1} de 3.`,
    };
  }

  // Localizar o responsável no sistema — antes de marcar o OTP como usado,
  // pra permitir reenviar/reconferir o CPF (abaixo) sem gastar o código.
  const { data: guardians } = await admin
    .from("guardians")
    .select("id, patient_id, profile_id, full_name, email, phone, cpf")
    .order("created_at", { ascending: true });

  const guardian = (guardians ?? []).find((g) => normalizeDigits(g.phone) === digits);

  if (!guardian) {
    return {
      success: false,
      error: "Cadastro do responsável não localizado.",
    };
  }

  // PRD §3.1: no primeiro acesso (ainda sem profile_id vinculado), exige
  // confirmação do CPF cadastrado antes de liberar o portal — só quando a
  // clínica já cadastrou um CPF pra esse responsável; sem isso, não há como
  // validar e o fluxo antigo (só telefone) continua valendo, pra não travar
  // cadastros incompletos.
  if (!guardian.profile_id && guardian.cpf) {
    const cpfDigits = (cpf ?? "").replace(/\D/g, "");
    if (!cpfDigits) {
      return {
        success: false,
        requiresCpf: true,
        error: "Confirme o CPF do responsável cadastrado na clínica para continuar.",
      };
    }
    if (cpfDigits !== guardian.cpf.replace(/\D/g, "")) {
      // Mesmo contador de tentativas do código OTP (family_otp_codes.attempts)
      // — evita brute-force de CPF sem precisar de uma coluna nova.
      await admin
        .from("family_otp_codes")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);

      return {
        success: false,
        requiresCpf: true,
        error: `CPF não confere com o cadastro. Tentativa ${otp.attempts + 1} de 3.`,
      };
    }
  }

  // Marcar código como utilizado
  await admin.from("family_otp_codes").update({ used: true }).eq("id", otp.id);

  // Buscar dados da clínica vinculada ao paciente
  const { data: patient } = await admin
    .from("patients")
    .select("clinic_id")
    .eq("id", guardian.patient_id)
    .single();

  if (!patient) {
    return { success: false, error: "Paciente vinculado não encontrado." };
  }

  const email = guardian.email
    ? guardian.email.toLowerCase().trim()
    : `responsavel_${digits}@familia.clinica.local`;

  // Chave determinística de autenticação segura para o perfil responsavel
  const secretPassword = `OtpAuth_Resp_${digits}_${patient.clinic_id.slice(0, 8)}`;

  let targetUserId = guardian.profile_id;

  // Se não possuir profile_id ou usuário auth, obter ou criar
  if (!targetUserId) {
    const { data: userList } = await admin.auth.admin.listUsers();
    const existingUser = userList?.users?.find((u) => u.email === email);

    if (existingUser) {
      targetUserId = existingUser.id;
      await admin.auth.admin.updateUserById(targetUserId, {
        password: secretPassword,
      });
    } else {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password: secretPassword,
        email_confirm: true,
        user_metadata: { full_name: guardian.full_name, role: "responsavel" },
      });

      if (createError || !newUser.user) {
        console.error("Erro ao criar usuário auth para responsável:", createError);
        return { success: false, error: "Falha ao provisionar conta de acesso da família." };
      }
      targetUserId = newUser.user.id;
    }

    // Criar perfil em `profiles` se não existir
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!existingProfile) {
      await admin.from("profiles").insert({
        id: targetUserId,
        clinic_id: patient.clinic_id,
        role: "responsavel",
        full_name: guardian.full_name,
        phone: guardian.phone,
        active: true,
      });
    }

    // Vincular `profile_id` na tabela `guardians`
    await admin
      .from("guardians")
      .update({ profile_id: targetUserId, portal_enabled: true })
      .eq("id", guardian.id);

    // Conceder permissão na tabela `patient_access` se necessário
    const { data: access } = await admin
      .from("patient_access")
      .select("id")
      .eq("patient_id", guardian.patient_id)
      .eq("profile_id", targetUserId)
      .maybeSingle();

    if (!access) {
      await admin.from("patient_access").insert({
        patient_id: guardian.patient_id,
        profile_id: targetUserId,
        access_type: "responsavel",
      });
    }
  } else {
    // Atualizar senha determinística para garantir login
    await admin.auth.admin.updateUserById(targetUserId, {
      password: secretPassword,
    });
  }

  // Efetuar o login do cliente na sessão da requisição Next.js
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: secretPassword,
  });

  if (signInError) {
    console.error("Erro no signInWithPassword da família:", signInError);
    return { success: false, error: "Falha ao iniciar sessão. Tente novamente." };
  }

  redirect("/familia");
}
