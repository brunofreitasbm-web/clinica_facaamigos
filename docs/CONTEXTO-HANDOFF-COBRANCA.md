# Contexto de retomada: Pacote de Sessões, cobrança automática (Asaas)

Documento autossuficiente para continuar este trabalho em outra conta Claude ou sessão. Atualizado em 05/11/2026.
Repositório: `brunofreitasbm-web/clinica_facaamigos` · branch `ccr-b58a6b3c-obdmzs` · **PR #91 (rascunho)**.

## 1. Quem é o usuário e como trabalhar com ele
- Bruno Freitas, dono do projeto (Instituto Faça Amigos LTDA, clínica TEA/TDAH em Belém-PA, abre em dezembro de 2026). Fala português.
- Preferências declaradas: **não concordar por padrão**, testar a ideia antes de validar, apontar o ponto mais fraco primeiro, sem elogio sem substância, respostas diretas e curtas, "não" na primeira frase quando for não. Fazer perguntas em formato de quiz quando isso melhorar a resposta.
- Regras do repositório (`AGENTS.md`):
  - Next.js com mudanças incompatíveis: ler `node_modules/next/dist/docs/` antes de escrever código (rode `npm ci` antes; `node_modules` não vem no clone).
  - **Todo KPI de BI precisa de comparativo** (vs mês anterior, vs meta...).
  - Dashboards são páginas do próprio sistema, sem ferramenta paga de BI.
  - Prevenção de duplicidade em autorizações e agenda de 1ª avaliação.

## 2. O que o Bruno decidiu (e por quê)
| Decisão | Motivo / observação |
|---|---|
| Produto = **Pacote de Sessões**, quantidade fixa por mês, valor fechado | Nunca usar "plano", "plano de saúde", "cobertura", "carência", "ilimitado" em marketing, site, bot ou peças. A cláusula de natureza do serviço (Lei 9.656/98) fica **só no contrato** |
| Pagamento por **Pix Automático** (padrão) e **boleto** | Público sem cartão. Pix Automático elimina o esquecimento; boleto é exceção |
| **Pacote Ponte**: 6 sessões, R$ 1.050, **só Pix Automático**, porta de entrada | 2 sessões/semana em 3 semanas; 4ª semana livre. Código `PART-PLANO-PONTE`. Gate: se >20% do Laço migrar, subir para R$ 1.068 |
| **Pré-pago**: vence dia 25 do mês anterior à competência | Boleto pós-pago seria dar crédito sem análise |
| Sem fidelidade; cancelamento com 30 dias | Cláusula de fidelidade em serviço de saúde infantil é arriscada |
| Gateway **Asaas**, Efí como reserva | Único com Pix Automático **documentado** na API; Mercado Pago e Stripe sem confirmação |
| Negativação, protesto e suspensão **nunca automáticos** | A régua só cria tarefa para uma pessoa |

Catálogo: Encontro (avulso) R$ 190 · Primeiro Passo 4/mês R$ 720 · **Ponte 6/mês R$ 1.050** · Laço 8 R$ 1.400 · Vínculo 12 R$ 1.990 · Turma 16 R$ 2.580 · Abraço 20 R$ 3.120 · Voo Livre 24 R$ 3.640.

## 3. O que está pronto (no PR #91)
- **Documento de negócio:** `docs/pacote-de-sessoes-pix-boleto.md` (cenários conservadores, riscos, cobrança, segurança, blindagem, marketing, roadmap).
- **Migration:** `supabase/migrations/20261105120000_payments_gateway_billing.sql` (fecha o drift de colunas, colunas do gateway, `payment_events`, `dunning_log`, pré-pago, `mark_overdue_invoices`, 4 jobs de pg_cron, linha do Pacote Ponte). Testada duas vezes num Postgres de teste.
- **Camada de pagamento** `lib/payments/`: `provider.ts` (interface `PaymentProvider`), `asaas.ts` (cliente), `index.ts`, `billing-pure.ts` (regras), `asaas-pure.ts` (webhook), `dunning-messages.ts`, `kpis-pure.ts`, `cpf-pure.ts`, `db.ts`.
- **Rotas:** `app/api/billing/emit` e `app/api/billing/dunning` (cron, `x-cron-secret`), `app/api/webhooks/asaas`.
- **Telas do gestor:** `/gestor/contratos` (forma de pagamento, responsável financeiro, autorização Pix, baixa manual com motivo) e `/gestor/financeiro/cobranca` (KPIs com comparativo, atraso por faixa, contratos para revisar).
- **Testes:** `tests/billing-pure`, `asaas-pure`, `asaas-client`, `dunning-messages`, `kpis-pure` (+ a suíte existente). Rodar: `npm test`, `npm run typecheck`, `npm run lint`.
- **Runbook de ativação:** `docs/runbooks/ativar-cobranca-asaas.md`.

## 4. O que NÃO está pronto
1. **Portal da família** (`app/familia`): faturas, 2ª via, QR/boleto, recibos. Não foi feito.
2. **NFS-e automática** na confirmação do pagamento (campo `nfse_id` existe, sem integração).
3. **Provider do Efí**: só existe a interface; não há `efi.ts`.
4. **Renomear "Plano" → "Pacote" no que já existe:** bot (`lib/twilio-faq-bot.ts`, `lib/welcome-menu.ts`), `chatbot-base-conhecimento.md` e as linhas `PART-PLANO-*` de `insurer_price_tables` (nome "Plano X"). O catálogo já aceita "Pacote X" (`lib/particular-plans-pure.ts`).
5. **Templates de WhatsApp** aprovados na Meta e suas variáveis de ambiente.
6. **Conta e chaves do Asaas**, webhook cadastrado, piloto (ver runbook).
7. **Artefato publicado está desatualizado:** https://claude.ai/artifact/X8Xsj9kKRhFQfBJo8UYvNY ainda tem "Plano Próprio", fala em "plano de saúde" e traz a **afirmação errada** sobre acesso do terapeuta (item 5.1). Precisa ser republicado a partir de `docs/pacote-de-sessoes-pix-boleto.md`.
8. **Build:** `next build --webpack` com fontes do Google simuladas (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) compilou e listou as 5 rotas novas. **Não** foi testado o bundler padrão (Turbopack, que `npm run build` usa): ele busca as fontes por conta própria e falha neste ambiente sem rede. O workflow de CI (`.github/workflows/ci.yml`) roda só `npm ci`, `typecheck` e `npm test`, sem build. Rodar `npm run build` com rede (ou conferir o deploy de preview) antes de mergear.

## 5. Erros e correções (leia para não repetir)
1. **Acesso ao financeiro:** uma exploração inicial concluiu que contratos e faturas tinham RLS só por clínica, e isso foi repetido ao usuário. **Está errado.** `20260908060000_onda1_contracts_inventory_rls.sql` restringe `patient_contracts` e `contract_invoices` ao gestor. Verifique o arquivo mais recente que mexe numa política antes de afirmar algo sobre RLS.
2. Os demais achados do levantamento foram conferidos no repositório e se confirmam: sem agendamento para `generate_package_invoices`, colunas usadas sem migration criadora, nada marca fatura como `atrasado`, view de faturamento do BI lê `billing_batches` (inexistente).
3. Preços de gateways vêm de blogs e divergem; conferir tabelas oficiais antes de contratar. "Paguelá" não foi encontrado.

## 6. Particularidades do Asaas Pix Automático (que moldam o código)
- Autorização: `POST /v3/pix/automatic/authorizations`; a família autoriza **ao pagar o QR da 1ª cobrança**; só vira `ACTIVE` depois, por webhook.
- O Asaas **não cria as cobranças mensais** (modo MANUAL): o sistema cria uma por ciclo (`POST /v3/payments` com `pixAutomaticAuthorizationId`), **2 a 10 dias úteis antes do vencimento**, só com a autorização ACTIVE.
- Valor fixo na autorização; mudar o preço = cancelar e criar outra (reajuste anual exige nova autorização).
- Webhook "pelo menos uma vez": idempotência pelo id do evento; header `asaas-access-token`.
- Autenticação da API: header `access_token`. Sandbox: `https://api-sandbox.asaas.com`. URL de produção: não confirmada no repositório.

## 7. Riscos abertos (decisões que dependem de profissional)
- ⚖️ Advogado: texto do contrato e da cláusula de natureza do serviço, assinatura eletrônica como título executivo, nome comercial, notificação antes de negativar, multa/juros (2% + 1% a.m.).
- 🧾 Contador: regime tributário (a premissa de 14% é estimativa), ISS de Belém, NFS-e, dedução no IR do responsável.
- Números de cenário são **premissas de mercado**, não dados da clínica. Faltam: custo real por sessão PJ, demanda real (leads que pediram valor particular no bot), capacidade ociosa.

## 8. Variáveis de ambiente
`ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET` (já existe), `TWILIO_BILLING_REMINDER_TEMPLATE_CONTENT_SID`, `TWILIO_BILLING_OVERDUE_TEMPLATE_CONTENT_SID`, `TWILIO_BILLING_FORMAL_TEMPLATE_CONTENT_SID`. Nenhum segredo está no repositório.

## 9. Prompt para colar na nova conta
> Estou retomando o trabalho de cobrança do Pacote de Sessões da clínica Faça Amigos. Clone `brunofreitasbm-web/clinica_facaamigos`, branch `ccr-b58a6b3c-obdmzs` (PR #91). Leia primeiro `AGENTS.md` e `docs/CONTEXTO-HANDOFF-COBRANCA.md`, depois `docs/pacote-de-sessoes-pix-boleto.md` e `docs/runbooks/ativar-cobranca-asaas.md`. Rode `npm ci`, `npm test` e `npm run typecheck` para confirmar o estado. Não afirme nada sobre RLS ou colunas sem ler as migrations. Próximos passos, nesta ordem: (1) republicar o artefato a partir do documento atualizado, (2) renomear "Plano" para "Pacote" no bot e no catálogo, (3) portal da família com faturas e 2ª via, (4) acompanhar o piloto no sandbox do Asaas. Não use "plano de saúde", "plano" ou "cobertura" em nenhuma peça de marketing. Seja direto, questione antes de concordar e faça perguntas curtas quando faltar decisão.
