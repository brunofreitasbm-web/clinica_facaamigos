// Prefixos de rota abertos (sem sessão). Compartilhado pelo middleware e por lib/recadastro.ts.
// Prefixos abertos: a tela pública do check-in por QR (app/checkin), sua
// API (app/api/checkin), a ficha que a família preenche por link
// (app/ficha). Precisam ser prefixo, não igualdade
// exata, porque o token vai no path (/checkin/<token>, /ficha/<token>).
// "/login" continua tratado à parte por igualdade — é o único caminho que
// também expulsa quem já está logado (ver o uso de LOGIN_PATH abaixo); um
// recepcionista logado precisa conseguir abrir /checkin para testar o
// cartaz sem ser redirecionado e /ficha para conferir o link antes de mandar
// para a família.
//
// /robots.txt (app/robots.ts) também entra: é pedido por crawler, sem cookie
// de sessão — sem isso aqui, o middleware o redirecionava para /login.
//
// /api/webhooks e /api/twilio também precisam ser públicos: são chamados
// pelo Twilio (webhook inbound, voice/twiml, voice/status) ou pelo Vercel
// Cron (rotas */trigger), nenhum dos dois manda cookie de sessão do
// Supabase. Sem isso o middleware redirecionava pra /login e o Twilio
// recebia HTML em vez de TwiML (erro 12200 "document parse failure") —
// mensagens de WhatsApp chegavam no Twilio mas nunca apareciam na Central
// de Atendimento. Essas rotas já se autenticam por conta própria (assinatura
// X-Twilio-Signature ou header CRON_SECRET), então ficam abertas com
// segurança aqui.
export const PUBLIC_PREFIXES = [
  "/checkin",
  "/api/checkin",
  "/ficha",
  "/robots.txt",
  "/api/webhooks",
  "/api/twilio",
  // Workers de fundo chamados pelo pg_cron (jobs process_registration_drafts
  // e process_insurance_intake). Sem isso o middleware responde a página de
  // login com 200, e o cron "tem sucesso" enquanto nada é processado — foi o
  // que manteve os rascunhos do WhatsApp parados em `pending`. Como as rotas
  // do Twilio acima, elas se autenticam por conta própria (x-cron-secret) e
  // devolvem 401 sem o header, então abrir aqui é seguro.
  "/api/extractions",
  "/api/intake",
  // Agente local do robô do portal do plano (docs/portal-robot.md): chama sem
  // cookie de sessão e se autentica pelo próprio token (Authorization: Bearer),
  // devolvendo 401 sem ele — mesmo raciocínio das rotas acima.
  "/api/portal-robot",
  // Porta de entrada do Hub de Gestão (app/auth/sso): chega sem sessão por
  // definição — é ela que cria a sessão a partir do token de uso único.
  "/auth/sso",
  "/esqueci-senha",
  "/primeiro-acesso",
];
