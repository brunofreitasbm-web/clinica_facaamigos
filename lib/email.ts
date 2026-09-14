import { CLINIC_BRAND, CLINIC_TAGLINE } from "@/lib/clinic-identity";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Endereço de remetente padrão oficial.
 * Domínio configurado no Registro.br: institutofacaamigos.com.br
 */
export const DEFAULT_EMAIL_FROM =
  process.env.BREVO_FROM_EMAIL ||
  `Instituto Faça Amigos <instituto@institutofacaamigos.com.br>`;

/**
 * Endereço de resposta padrão. institutofacaamigos.com.br não tem caixa de
 * entrada (sem registro MX, por decisão do dono) — sem isso, qualquer
 * resposta de paciente/responsável a um e-mail automático voltaria com
 * erro de entrega. Configure BREVO_REPLY_TO com uma caixa que alguém
 * realmente lê.
 */
export const DEFAULT_REPLY_TO = process.env.BREVO_REPLY_TO || undefined;

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
 * Extrai nome e e-mail de um endereço no formato "Nome <email@dominio>" ou "email@dominio".
 */
function parseAddress(address: string): { name?: string; email: string } {
  const match = address.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || undefined, email: match[2].trim() };
  }
  return { email: address.trim() };
}

/**
 * Envia um e-mail através da API transacional do Brevo (ex-Sendinblue).
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = DEFAULT_EMAIL_FROM,
  replyTo = DEFAULT_REPLY_TO,
}: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn("[Brevo] AVISO: BREVO_API_KEY não foi definida nas variáveis de ambiente.");
    return {
      success: false,
      error: "BREVO_API_KEY não está configurada no servidor.",
    };
  }

  const toList = (Array.isArray(to) ? to : [to]).map(parseAddress);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: parseAddress(from),
        to: toList,
        subject,
        htmlContent: html,
        textContent: text,
        ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.message || `Erro HTTP ${response.status} ao enviar e-mail.`;
      console.error("[Brevo] Erro ao enviar e-mail:", data);
      return { success: false, error: errorMessage };
    }

    return { success: true, id: data?.messageId || "" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido ao enviar e-mail.";
    console.error("[Brevo] Exceção no disparo de e-mail:", err);
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
  <!--[if !mso]><!-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    body { font-family: 'Nunito', 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f7f5f2; margin: 0; padding: 0; color: #1a3f35; }
    .wrapper { width: 100%; background-color: #f7f5f2; padding: 32px 16px; box-sizing: border-box; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 16px rgba(26, 63, 53, 0.08); }
    .header { background: linear-gradient(135deg, #f0196b 0%, #c8155a 100%); padding: 36px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-family: 'Fredoka One', 'Fredoka', 'Nunito', 'Comic Sans MS', sans-serif; font-size: 28px; font-weight: 400; letter-spacing: -0.5px; color: #ffffff; }
    .header p { margin: 6px 0 0 0; font-family: 'Nunito', 'Segoe UI', sans-serif; font-size: 13px; font-weight: 800; color: #ffe234; text-transform: uppercase; letter-spacing: 0.14em; }
    .body { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #1a3f35; }
    .body h2 { font-family: 'Fredoka One', 'Fredoka', 'Nunito', 'Comic Sans MS', sans-serif; font-weight: 400; }
    .button-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #f0196b; color: #ffffff !important; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-size: 15px; }
    .footer { background-color: #f7f5f2; padding: 24px; text-align: center; font-size: 12px; color: #5a636e; border-top: 1px solid #e8eaec; }
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
        <h2 style="margin-top:0;font-size:20px;color:#1a3f35;">${title}</h2>
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
