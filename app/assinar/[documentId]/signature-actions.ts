"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestFamilyOtp } from "@/app/login/otp-actions";
import { sendEmail, renderBrandEmailHtml } from "@/lib/email";
import { CLINIC_BRAND, CLINIC_TAGLINE } from "@/lib/clinic-identity";

export interface DocumentSignatureData {
  id: string;
  title: string;
  category: string;
  patientId: string;
  patientName: string;
  guardianName?: string;
  guardianCpf?: string;
  guardianPhone?: string;
  content: string;
  validUntil?: string | null;
  uploadedAt: string;
  isSigned: boolean;
  signatureDetails?: {
    signedAt: string;
    signerName: string;
    signerCpf: string;
    documentHash: string;
    validationCode: string;
    emailSentTo?: string | null;
  } | null;
}

function normalizeDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Busca dados do documento para exibição na tela de assinatura digital.
 */
export async function getDocumentForSignature(
  documentId: string,
): Promise<{ success: boolean; data?: DocumentSignatureData; error?: string }> {
  try {
    const admin = createAdminClient();

    // Caso de Teste / Exemplo amigável para demonstração
    if (documentId === "doc-9823" || documentId === "demo") {
      return {
        success: true,
        data: {
          id: documentId,
          title: "Termo de Consentimento Livre e Esclarecido (TCLE) — Plano Terapêutico Multidisciplinar",
          category: "termo",
          patientId: "demo-patient-id",
          patientName: "Gabriel Santos Silva",
          guardianName: "Maria da Silva",
          guardianPhone: "11999998888",
          guardianCpf: "123.456.789-00",
          content: `CONTRATO DE ADESÃO E TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA TRATAMENTO MULTIDISCIPLINAR (ABA, FONOAUDIOLOGIA E TERAPIA OCUPACIONAL)

1. OBJETO E FINALIDADE
Pelo presente instrumento, o Responsável Legal autoriza expressamente a equipe multidisciplinar da Clínica Faça Amigos a realizar avaliações clínicas, intervenções comportamentais baseadas na Análise do Comportamento Aplicada (ABA), fonoterapêuticas e ocupacionais para o desenvolvimento do paciente.

2. FREQUÊNCIA E PLANO TERAPÊUTICO SINGULAR (PTS)
As sessões serão conduzidas por profissionais capacitados, seguindo a frequência semanal estabelecida no Plano Terapêutico Singular (PTS), com reavaliações periódicas a cada 6 meses.

3. USO DE REGISTROS DE EVOLUÇÃO
O Responsável declara ter ciência de que todas as evoluções clínicas, metas de desenvolvimento e acompanhamentos serão devidamente registrados no Prontuário Único Unificado do paciente, garantindo o sigilo médico e a conformidade com a LGPD (Lei Geral de Proteção de Dados Pessoais).

4. CONFIRMAÇÃO DE ASSINATURA ELETRÔNICA
A validação deste documento será efetuada mediante envio e digitação de Código de Verificação Único (OTP) enviado via SMS/WhatsApp para o número cadastrado do Responsável, gerando protocolo com carimbo de integridade SHA-256 e trilha de auditoria digital.`,
          uploadedAt: new Date().toISOString(),
          isSigned: false,
        },
      };
    }

    // Busca real no Supabase
    const { data: doc, error: docError } = await admin
      .from("documents")
      .select("id, category, storage_path, uploaded_at, valid_until, patient_id")
      .eq("id", documentId)
      .maybeSingle();

    if (docError || !doc) {
      return { success: false, error: "Documento não encontrado ou link expirado." };
    }

    const { data: patient } = await admin
      .from("patients")
      .select("full_name")
      .eq("id", doc.patient_id)
      .maybeSingle();

    const { data: signature } = await (admin as any)
      .from("document_signatures")
      .select("*")
      .eq("document_id", documentId)
      .eq("status", "assinado")
      .maybeSingle();

    const { data: guardian } = await admin
      .from("guardians")
      .select("full_name, cpf, phone")
      .eq("patient_id", doc.patient_id)
      .maybeSingle();

    return {
      success: true,
      data: {
        id: doc.id,
        title: `Documento Terapêutico — Categoria: ${doc.category.toUpperCase()}`,
        category: doc.category,
        patientId: doc.patient_id,
        patientName: patient?.full_name || "Paciente sem nome",
        guardianName: guardian?.full_name || undefined,
        guardianCpf: guardian?.cpf || undefined,
        guardianPhone: guardian?.phone || undefined,
        content: `TERMO E DOCUMENTO DE ACOMPANHAMENTO CLÍNICO

Documento registrado sob a categoria: ${doc.category}.
Paciente: ${patient?.full_name || "N/A"}
Data de Emissão: ${new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}

Este documento constitui parte integrante do Prontuário Único Unificado da Clínica Faça Amigos. A confirmação desta assinatura via código OTP declara ciência do responsável legal.`,
        validUntil: doc.valid_until,
        uploadedAt: doc.uploaded_at,
        isSigned: Boolean(signature),
        signatureDetails: signature
          ? {
              signedAt: signature.signed_at,
              signerName: signature.signer_name,
              signerCpf: signature.signer_cpf,
              documentHash: signature.document_hash,
              validationCode: signature.otp_code_used,
              emailSentTo: signature.email_sent_to,
            }
          : null,
      },
    };
  } catch (err: unknown) {
    console.error("Erro ao buscar documento:", err);
    return { success: false, error: "Erro interno ao carregar documento." };
  }
}

/**
 * Solicita o código OTP via SMS/WhatsApp Twilio para o responsável.
 */
export async function sendSignatureOtpCode(
  rawPhone: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
  return await requestFamilyOtp(rawPhone);
}

/**
 * Valida o código OTP e registra a Assinatura Eletrônica no Prontuário Unificado.
 */
export async function confirmDocumentSignature(params: {
  documentId: string;
  rawPhone: string;
  otpCode: string;
  signerName: string;
  signerCpf: string;
  ipAddress?: string;
}): Promise<{
  success: boolean;
  error?: string;
  signatureDetails?: {
    signedAt: string;
    documentHash: string;
    validationCode: string;
  };
}> {
  const digits = normalizeDigits(params.rawPhone);
  const cleanCode = params.otpCode.trim();

  if (!digits || cleanCode.length !== 6) {
    return { success: false, error: "Informe um telefone válido e o código de 6 dígitos." };
  }

  const admin = createAdminClient();

  // 1. Validar OTP em family_otp_codes
  const { data: otpRecords, error: otpError } = await admin
    .from("family_otp_codes")
    .select("*")
    .eq("phone", digits)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (otpError || !otpRecords || otpRecords.length === 0) {
    return {
      success: false,
      error: "Nenhum código OTP pendente encontrado para este número. Solicite um novo código.",
    };
  }

  const otp = otpRecords[0];

  if (new Date(otp.expires_at) < new Date() || otp.attempts >= 3) {
    return {
      success: false,
      error: "Código expirado ou limite de tentativas excedido. Solicite um novo código.",
    };
  }

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

  // Marcar OTP como utilizado
  await admin.from("family_otp_codes").update({ used: true }).eq("id", otp.id);

  // 2. Gerar Hash de Integridade (SHA-256)
  const nowIso = new Date().toISOString();
  const hashPayload = `${params.documentId}|${params.signerCpf}|${params.signerName}|${digits}|${nowIso}`;
  const documentHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

  // Buscar documento e responsável se existirem no banco
  let patientId: string | null = null;
  let guardianId: string | null = null;

  if (params.documentId !== "doc-9823" && params.documentId !== "demo") {
    const { data: doc } = await admin
      .from("documents")
      .select("patient_id")
      .eq("id", params.documentId)
      .maybeSingle();

    if (doc) {
      patientId = doc.patient_id;
      // Atualizar documento para ser acessível na família e marcar atualizado
      await admin
        .from("documents")
        .update({ shared_with_family: true })
        .eq("id", params.documentId);
    }
  }

  // 3. Registrar Assinatura Eletrônica em document_signatures
  if (params.documentId !== "doc-9823" && params.documentId !== "demo") {
    await (admin as any).from("document_signatures").insert({
      document_id: params.documentId,
      patient_id: patientId,
      guardian_id: guardianId,
      signer_name: params.signerName,
      signer_cpf: params.signerCpf,
      signer_phone: digits,
      signer_ip: params.ipAddress || "127.0.0.1",
      otp_code_used: cleanCode,
      document_hash: documentHash,
      signed_at: nowIso,
      status: "assinado",
    });
  }

  return {
    success: true,
    signatureDetails: {
      signedAt: nowIso,
      documentHash: documentHash.substring(0, 16).toUpperCase(),
      validationCode: `OTP-FA-${cleanCode}`,
    },
  };
}

/**
 * Envia cópia do documento assinado por e-mail via Brevo API (`lib/email.ts`).
 */
export async function sendSignedDocumentEmail(params: {
  documentId: string;
  recipientEmail: string;
  signerName: string;
  patientName: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const emailTrimmed = params.recipientEmail.trim().toLowerCase();

  if (!emailTrimmed || !emailTrimmed.includes("@")) {
    return { success: false, error: "Informe um endereço de e-mail válido." };
  }

  const title = `Comprovante de Assinatura Eletrônica — ${params.patientName}`;
  const nowFormatted = new Date().toLocaleString("pt-BR");

  const contentHtml = `
    <div style="font-family: Arial, sans-serif; color: #1e293b;">
      <p>Olá, <strong>${params.signerName}</strong>!</p>
      <p>Confirmamos o recebimento e o arquivamento da sua <strong>Assinatura Eletrônica</strong> no Prontuário Único Unificado da Clínica Faça Amigos.</p>
      
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 20px 0;">
        <h4 style="margin: 0 0 8px 0; color: #15803d;">Selo de Validação Jurídica</h4>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Paciente:</strong> ${params.patientName}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Assinado por:</strong> ${params.signerName}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Data e Hora:</strong> ${nowFormatted}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Autenticação:</strong> Código OTP via SMS/WhatsApp</p>
      </div>

      <p>Este documento possui validade legal conforme a Lei nº 14.063/2020 e a MP nº 2.200-2/2001 e já se encontra arquivado com total segurança na clínica.</p>
      <p>Caso precise de suporte, nossa equipe está à disposição no WhatsApp oficial da clínica.</p>
    </div>
  `;

  const html = renderBrandEmailHtml({
    title,
    preheader: `Cópia do documento assinado de ${params.patientName}`,
    contentHtml,
  });

  const result = await sendEmail({
    to: emailTrimmed,
    subject: `[FaçaAmigos] Documento Assinado — ${params.patientName}`,
    html,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Atualizar registro no banco se não for demo
  if (params.documentId !== "doc-9823" && params.documentId !== "demo") {
    const admin = createAdminClient();
    await (admin as any)
      .from("document_signatures")
      .update({ email_sent_to: emailTrimmed })
      .eq("document_id", params.documentId);
  }

  return {
    success: true,
    message: `Cópia enviada com sucesso para ${emailTrimmed}!`,
  };
}
