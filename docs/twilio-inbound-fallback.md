# Fallback do webhook de entrada (WhatsApp)

Fluxo: Twilio → `/api/webhooks/twilio` (grava em `twilio_inbound_queue`, processa, marca `done`).
Se o processamento falhar, a linha fica `pending` e o cron `twilio_inbound_retry` (1/min)
chama `/api/twilio/inbound-retry` (até 5 tentativas; mensagens com mais de 20 h não recebem resposta automática).
Se o app estiver fora do ar, a Twilio chama a **Fallback URL**: a Edge Function `twilio-inbound-fallback`
valida a assinatura e só enfileira; o cron processa quando o app voltar.

## Ativação (manual, uma vez)
1. Aplicar a migration `20261009120000_twilio_inbound_queue.sql`.
2. `supabase functions deploy twilio-inbound-fallback --no-verify-jwt`
3. Secrets da função: `TWILIO_AUTH_TOKEN`, `TWILIO_FALLBACK_PUBLIC_URL` (URL exata da função).
4. Twilio Console → número/Messaging Service do WhatsApp → **Fallback URL** = URL da função (HTTP POST).

Limite conhecido: se o app cair DEPOIS de gravar a mensagem em `messages` e antes de responder,
o reprocesso é tratado como duplicata (dedupe por `twilio_sid`) e a resposta automática não é reenviada;
a mensagem do cliente continua visível na inbox.
Monitorar: `select * from twilio_inbound_queue where status <> 'done'`.
