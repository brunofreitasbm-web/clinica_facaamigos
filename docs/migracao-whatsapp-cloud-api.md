# Migração WhatsApp: Twilio → Cloud API direta da Meta (com Coexistência)

Objetivo: usar o WhatsApp Business no celular **junto** com o CRM no mesmo número.
Não é objetivo reduzir o custo de template de marketing (tarifa da Meta, igual nos dois caminhos).
Fica na Twilio: Voz (TwiML) e OTP (Verify). Só o canal WhatsApp migra.

## Passo 0 — Pré-requisitos (fora do código, bloqueiam tudo)
1. Meta Business Manager verificado + WABA da clínica.
2. App Meta com produto WhatsApp e acesso de Tech Provider (necessário para o Embedded Signup de coexistência — confirmar no painel da Meta; fontes de fornecedores, não doc oficial).
3. Confirmar se o número é Twilio (virtual) ou chip próprio. Coexistência exige o número no app **WhatsApp Business** num celular, com 7+ dias de uso ativo (fontes divergem: até 1–2 meses).
4. Remover o número da Twilio só no dia do corte. Templates aprovados precisam ser recriados/migrados na WABA da Meta (SIDs de Content API deixam de valer).
5. Coexistência: abrir o app no celular ao menos a cada 13 dias.

## Passo 1 — Camada de provedor (reversível)
Criar `lib/whatsapp/` com interface única `sendText`, `sendTemplate`, `sendMedia`, `parseInbound`, `parseStatus`, `verifySignature`.
Implementações `twilio` e `meta`, escolhidas por `WHATSAPP_PROVIDER`. Migrar chamadores para a interface antes de ligar a Meta.

## Passo 2 — Pontos de código afetados
| Área | Arquivos | Mudança |
|---|---|---|
| Envio | `lib/twilio.ts` (`sendTwilioWhatsApp`) | POST `graph.facebook.com/vXX/{phone_number_id}/messages`, Bearer token |
| Janela 24h | `WHATSAPP_WINDOW_CLOSED_ERROR_CODES` (63016, 63024) | Mapear para 131047 (fora da janela) da Meta |
| Templates | `TWILIO_*_TEMPLATE_CONTENT_SID`, tabela `twilio_message_templates`, `template-send-picker.tsx`, `scripts/create-twilio-content-template.ts` | Enviar por `template.name` + `language` + `components`, não por ContentSid |
| Webhook entrada | `app/api/webhooks/twilio/route.ts`, `lib/twilio-inbound*.ts`, `supabase/functions/twilio-inbound-fallback` | GET de verificação (`hub.challenge`) + POST JSON; assinatura `X-Hub-Signature-256` (HMAC-SHA256 com app secret) |
| Status | `app/api/webhooks/twilio/status/route.ts` | `statuses[]`: sent/delivered/read/failed |
| Mídia | `app/api/arquivos/mensagem/[messageId]/route.ts`, `lib/registration-drafts-ingest.ts` | Entrada traz `media id`; baixar via GET `/{media-id}` e depois a URL com Bearer |
| Ecos (coexistência) | novo handler | Campo `smb_message_echoes`: mensagem digitada no celular. Gravar como saída humana e **pausar o bot** (`is_bot_active=false`), igual ao envio manual |
| Dedupe | `twilio_inbound_queue` | Chave passa de `MessageSid` para `wamid` |
| Segredos | `.env.local.example` | `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN` (system user), `META_APP_SECRET`, `META_VERIFY_TOKEN` |

Não migram: `app/login/otp-actions.ts` (Verify), `app/api/twilio/voice/*`, `lib/twilio-voice.ts`.

## Passo 3 — Corte
1. Ligar `WHATSAPP_PROVIDER=meta` em preview, testar com número de teste da Meta.
2. Cadastrar templates na Meta e aguardar aprovação.
3. Remover o número da Twilio, concluir Embedded Signup com coexistência.
4. Apontar o webhook da Meta para a Vercel de produção; migration antes do merge em main.
5. Observar 48 h: entrega, ecos, bot pausando. Rollback = voltar a variável (se o número ainda estiver na Twilio) — depois do corte não há rollback simples.

## Riscos
- Número fora da Twilio não envia nem recebe até o Embedded Signup terminar: janela de indisponibilidade.
- Bot responder por cima da atendente se o eco do celular não for tratado.
- Templates reprovados ou recategorizados pela Meta mudam o custo.
- Conta Twilio compartilhada com o outro repositório: não encerrar a conta, só o sender deste número.
