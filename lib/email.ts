import { Resend } from "resend";
import { CLINIC_BRAND, CLINIC_TAGLINE } from "@/lib/clinic-identity";

/**
 * Instância lazy do cliente Resend.
 * Evita lançar exceção durante a inicialização do módulo se a chave ainda não estiver definida.
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Resend] AVISO: RESEND_API_KEY não foi definida nas variáveis de ambiente.");
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Endereço de remetente padrão oficial.
 * Domínio configurado no Registro.br: institutofacaamigos.com.br
 */
export const DEFAULT_EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL ||
  `Instituto Faça Amigos <instituto@institutofacaamigos.com.br>`;

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Envia um e-mail através da API do Resend.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = DEFAULT_EMAIL_FROM,
  replyTo,
}: SendEmailOptions): Promise<SendEmailResult> {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      error: "RESEND_API_KEY não está configurada no servidor.",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
    });

    if (error) {
      console.error("[Resend] Erro ao enviar e-mail:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id || "" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar e-mail.";
    console.error("[Resend] Exceção no disparo de e-mail:", err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Utilitário para gerar um layout de e-mail HTML bonito, responsivo e alinhado à marca FaçaAmigos.
 */
export function renderBrandEmailHtml({
  title,
  preheader,
  contentHtml,
  actionButton,
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  actionButton?: { text: string; url: string };
}): string {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; color: #1e293b; }
    .wrapper { width: 100%; background-color: #f4f6f8; padding: 32px 16px; box-sizing: border-box; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .body { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #334155; }
    .button-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${CLINIC_BRAND}</h1>
        <p>${CLINIC_TAGLINE}</p>
      </div>
      <div class="body">
        <h2 style="margin-top:0;font-size:18px;color:#0f172a;">${title}</h2>
        ${contentHtml}
        ${
          actionButton
            ? `
          <div class="button-container">
            <a href="${actionButton.url}" class="btn" target="_blank">${actionButton.text}</a>
          </div>
        `
            : ""
        }
      </div>
      <div class="footer">
        <p><strong>Instituto Faça Amigos</strong></p>
        <p>Desenvolvimento, Inclusão e Terapia Comportamental</p>
        <p>© ${year} Instituto Faça Amigos · Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
