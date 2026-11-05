# Runbook de ativação: plano particular de 6 sessões/mês (R$ 1.080), nome provisório "Passo Firme"

Estado atual: a linha `PART-PLANO-PASSO-FIRME` está **dormente** (`valid_from = 2099-01-01`) na migration
`supabase/migrations/20261105170000_particular_plan_6_sessoes_standby.sql` (ainda NÃO aplicada em nenhum projeto).
Nenhum código novo é necessário para ativar: bot, menu, IA e tela de contratos leem o catálogo.

Texto da KB/FAQ: [2026-11-05-pacote-6-sessoes-activation-runbook-kb-text.md](./2026-11-05-pacote-6-sessoes-activation-runbook-kb-text.md).

## Pré-requisitos (decisões do dono)
1. Nome comercial final (trocar "Passo Firme" na migration antes de aplicar, ou com o `update` de renomear descrito no cabeçalho dela).
2. Nova arte de valores do WhatsApp (`public/chatbot/planos-particular.jpg` e/ou `settings.particularPricesImageUrl`): a imagem é estática e hoje NÃO tem o plano de 6 sessões. Sem trocá-la, o bot enviaria a arte antiga com legenda sem o plano novo.
3. Confirmar regras comerciais do plano (avaliação conta 1 sessão, ABA = 3, parcelamento 3x): a observação da linha repete as dos demais planos.

## Passo a passo
1. **Migration** (dormente): aplicar `20261105170000_particular_plan_6_sessoes_standby.sql` (e, se aprovada, `20261105170100_contract_prepay_flag_overdue_view.sql`). Conferir: `select procedure_code, price, valid_from from insurer_price_tables where procedure_code = 'PART-PLANO-PASSO-FIRME';` deve mostrar 2099-01-01, e o plano NÃO deve aparecer em `/gestor/contratos` nem no menu.
2. **Preparar KB e arte** (sem publicar): revisar o texto do arquivo `-kb-text.md`; ter a nova arte pronta.
3. **SQL de ativação** (comando único):
   ```sql
   update public.insurer_price_tables set valid_from = current_date
    where procedure_code = 'PART-PLANO-PASSO-FIRME'
      and insurer_id = (select id from public.insurers where name = 'Particular');
   ```
4. **Regerar KB/auditoria do bot**: aplicar o `update` da FAQ (texto C, "sete pacotes"), atualizar `chatbot-base-conhecimento.md` (itens A e B) e a seção correspondente de `docs/chatbot-base-conhecimento-auditoria.md`; subir a nova arte. O cache de conhecimento do bot (`invalidateKnowledgeCache`) expira sozinho; se precisar, salvar qualquer FAQ no painel para invalidar.
5. **Conferir o menu do WhatsApp**: Atendimento particular > Valores. O texto/legenda deve listar "Passo Firme · 6 sessões/mês: R$ 1.080" entre Primeiro Passo e Laço; a imagem deve ser a nova. Limites do WhatsApp: a lista do submenu não lista planos (sem risco de 10 itens); texto de valores com 8 planos tem < 1.600 caracteres (coberto por teste).
6. **Contrato de teste**: em `/gestor/contratos` > Novo contrato, escolher um paciente de teste (particular puro, sem plano de saúde) e o pacote "Passo Firme · 6 sessões/mês". Conferir `monthly_fee = 1080`, `sessions_per_month = 6`, `unit_price = 180`, `billing_mode = 'pacote'`.
7. **Fatura de teste**: "Gerar Fatura do Mês" no contrato (valor R$ 1.080,00, status pendente). Conferir DRE/fluxo de caixa (`app/gestor/financeiro/dre/data.ts` soma `contract_invoices` pendentes/atrasadas) e marcar como paga para testar o fluxo. Atenção: o job `generate_package_invoices_monthly` (pg_cron, dia 1, 06:00 UTC) vai gerar fatura para contratos ativos; use paciente de teste e cancele o contrato de teste logo após.
8. **Desativar o teste**: cancelar o contrato de teste (`updateContractStatus` > cancelado) e cancelar/excluir a fatura de teste. Se a ativação oficial ainda não for hoje, rodar a DESATIVAÇÃO (abaixo).

## Checklist de reversão
- [ ] Plano volta a dormente: `update public.insurer_price_tables set valid_from = date '2099-01-01' where procedure_code = 'PART-PLANO-PASSO-FIRME' and insurer_id = (select id from public.insurers where name = 'Particular');` (efeito imediato no menu, IA e tela de contratos).
- [ ] FAQ `9efc1399-...` restaurada ao texto anterior (guardar o `select answer, keywords` antes do passo 4).
- [ ] `chatbot-base-conhecimento.md` e auditoria revertidos (git).
- [ ] Arte antiga de volta em `particularPricesImageUrl` / `public/chatbot/planos-particular.jpg`.
- [ ] Contratos reais já criados com o plano: continuam válidos (gravam `monthly_fee`/`sessions_per_month`); decidir com o dono se migram para outro plano ou seguem. Não apagar `contract_invoices`.
- [ ] Migration de flag/visão (opcional): `drop view public.v_contract_overdue_invoices; alter table public.patient_contracts drop column require_prepay;`.

## Pontos de atenção encontrados na análise
- `PARTICULAR_PLANS` (`lib/welcome-menu-pure.ts`) é só reserva quando o catálogo do banco falha; não inclui o novo plano. Se quiser consistência na reserva, adicionar `{ name: "Passo Firme", sessions: 6, price: 1080 }` na ativação (retrocompatível; o teste existente continua válido).
- A FAQ viva diz "seis pacotes, de 4 a 24 sessões": é texto livre no banco, não vem do catálogo; deve ser trocada na ativação (passo 4).
- As listas de procedimentos de `app/recepcao/pacientes/[id]/page.tsx` e `app/gestor/cadastros/tipos-atendimento/page.tsx` leem `insurer_price_tables` sem filtro de vigência; a linha dormente aparece nelas para o convênio Particular, como já ocorre com as demais PART-PLANO-*. Sem efeito em plano de saúde.
