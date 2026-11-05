# Ativar a cobrança automática (Asaas) em produção

Código e migration já estão no repositório. Nada cobra de verdade até você fazer os passos abaixo.
Faça **primeiro no sandbox**, depois em produção, com **1 família**.

## 0. O que já foi verificado e o que não foi
- **Verificado em teste automático:** regras de cobrança, régua, normalização do webhook, formato das chamadas ao Asaas (com resposta simulada), migration aplicada duas vezes num Postgres de teste, geração de fatura pré-paga.
- **Documentação oficial lida:** autorização do Pix Automático, cobrança vinculada à autorização, cancelamento, eventos do webhook, header `asaas-access-token`.
- **NÃO verificado (confirmar no sandbox antes de produção):** criação de cliente (`/v3/customers`), QR Pix da cobrança (`/v3/payments/{id}/pixQrCode`), cancelamento de cobrança (`DELETE /v3/payments/{id}`), busca por `externalReference`, campos `fine`/`interest` do boleto, URL de produção do Asaas, o payload real de `PAYMENT_RECEIVED` do 1º pagamento da autorização (o casamento por cliente+valor é uma suposição defensiva).
- **Não testado:** envio real por WhatsApp/e-mail, os jobs do `pg_cron`, `next build` completo (o ambiente de desenvolvimento não alcança o Google Fonts; o CI do PR cobre).

## 1. Conta Asaas
1. Abrir conta PJ (CNPJ do Instituto) e concluir a aprovação.
2. Gerar a chave de API do **sandbox** e, depois, a de **produção**.
3. Configurar o webhook na conta, com a URL `https://sistema.institutofacaamigos.com.br/api/webhooks/asaas`, um **token de autenticação** (qualquer valor longo e aleatório) e os eventos de cobrança e de Pix Automático.

## 2. Variáveis de ambiente (Vercel)
| Variável | Valor |
|---|---|
| `ASAAS_API_KEY` | chave do sandbox; troque pela de produção na virada |
| `ASAAS_BASE_URL` | sandbox: `https://api-sandbox.asaas.com`; produção: a URL de produção informada pelo Asaas (não confirmada neste repositório) |
| `ASAAS_WEBHOOK_TOKEN` | o mesmo token cadastrado no webhook |
| `CRON_SECRET` | já existe (mesmo valor do Vault) |
| `TWILIO_BILLING_REMINDER_TEMPLATE_CONTENT_SID` | template aprovado de lembrete (variáveis `{{1}}` nome, `{{2}}` valor, `{{3}}` vencimento, `{{4}}` competência) |
| `TWILIO_BILLING_OVERDUE_TEMPLATE_CONTENT_SID` | template aprovado de atraso (mesmas variáveis) |
| `TWILIO_BILLING_FORMAL_TEMPLATE_CONTENT_SID` | template aprovado de aviso formal (mesmas variáveis) |

Sem os templates, o WhatsApp só sai com texto livre se a janela de 24h estiver aberta; senão a régua usa o e-mail do responsável.

## 3. Banco
1. Aplicar `supabase/migrations/20261105120000_payments_gateway_billing.sql`.
2. Conferir o Vault: `select name from vault.decrypted_secrets where name = 'cron_secret';`
3. Conferir os jobs: `select jobname, schedule from cron.job where jobname like 'billing-%';` (4 linhas).
4. Regenerar `lib/database.types.ts` com `supabase gen types` (os tipos das colunas novas foram escritos à mão).

## 4. Templates de WhatsApp (Meta)
Texto sugerido, **sem terapia, diagnóstico ou criança**. Categoria *utility*.
- **Lembrete:** `Olá, {{1}}! A mensalidade de {{4}} do Instituto Faça Amigos ({{2}}) vence em {{3}}. Acesse o portal da família para a segunda via.`
- **Atraso:** `Olá, {{1}}! Não identificamos o pagamento da mensalidade de {{4}} ({{2}}), que venceu em {{3}}. Se já pagou, desconsidere. Acesse o portal da família para a segunda via.`
- **Formal:** `Olá, {{1}}! A mensalidade de {{4}} ({{2}}), vencida em {{3}}, segue em aberto. Fale conosco para combinarmos a melhor forma de resolver.`

## 5. Piloto com 1 família (sandbox, depois produção)
1. Em `/gestor/contratos`, criar o contrato com o responsável financeiro (CPF válido) e **Pix Automático**.
2. Clicar em **Gerar autorização Pix Automático**, copiar o Pix e pagar no app do banco de teste.
3. Esperar o webhook: o contrato deve mostrar **autorizado** e a fatura da 1ª competência, **Paga**.
4. No mês seguinte, conferir que a fatura foi gerada no dia 10, emitida entre 4 e 13 dias antes do vencimento e debitada sozinha.
5. Testar o caminho de falha: cancelar a autorização no banco e ver o contrato ir para "Revisar" (Ponte) ou virar boleto (demais).
6. Painel `/gestor/financeiro/cobranca` com os números do piloto.

**Só vender além do piloto depois de ver os itens 3, 4 e 5 funcionando.**

## 6. O que NUNCA é automático
Negativação, protesto e suspensão de agendamentos. A régua cria uma tarefa (D+6 ligação, D+15 notificação formal, D+30 suspensão) e uma pessoa decide.
