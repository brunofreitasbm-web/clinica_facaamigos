---
name: twilio-whatsapp-ai
description: "Use when working on Twilio WhatsApp bots, voice integration, Anthropic AI or Gemini document extraction, or automated messaging flows for intake, anamnesis, or absence alerts."
---

# Twilio & WhatsApp AI Bots

## Diretrizes Principais

1. **Estrutura das Integrações:**
   - Módulos Twilio em `lib/twilio*.ts` e webhooks em `app/api/twilio/` ou `app/whatsapp-bot/`.
   - Clientes de IA em `lib/anthropic.ts` e `lib/gemini.ts`.

2. **Fluxos de Atendimento Automático:**
   - **Bot de Intake/Triagem:** Coleta dados do lead e solicita fotos/PDFs da guia ou laudo.
   - **Extração com Gemini/Anthropic:** Realize a leitura estruturada dos campos do documento via visão/multimodal.
   - **Confirmação e Faltas:** Notificação e coleta de justificativa de falta com opções de reagendamento.

3. **Boas Práticas de Mensageria:**
   - Retorne respostas legíveis e amigáveis para mensageria móvel.
   - Trate erros de timeout de webhook Twilio de forma transparente.
