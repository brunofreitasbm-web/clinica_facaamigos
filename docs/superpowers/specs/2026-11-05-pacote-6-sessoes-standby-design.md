# Plano de 6 sessões em standby: cobrança antes do ciclo e bloqueio por atraso (desenho)

Data: 2026-11-05. Escopo: o que existe, o que foi implementado (dormente) e o que fica só em desenho.

## O que já existe (verificado no banco `vththexblpxwocbowhsv`, leitura)
- Job `generate_package_invoices_monthly` (pg_cron `0 6 1 * *`, UTC = 03:00 BRT dia 1) chama `generate_package_invoices()`: cria 1 fatura `pendente` por contrato `ativo`/`billing_mode='pacote'`, valor `monthly_fee`, vencimento em `invoice_day` (default 1, check 1..28), idempotente por `(contract_id, reference_month)`.
- `contract_invoices.status`: `pendente | pago | atrasado | cancelado`. **Nada marca `atrasado` automaticamente**: uma fatura vencida segue `pendente`. A tela de contratos só mostra o status gravado.
- `createContract` grava `payment_day` mas **não** `invoice_day` (fica 1). `generateMonthlyInvoice` (manual) usa `payment_day`; o job usa `invoice_day`. Os dois podem divergir.
- Não há gateway: `pix_code`/`boleto_url` ficam vazios; baixa é manual (`markInvoicePaid`).

## Bloqueio descoberto (PARAR e decidir): sessões usadas por plano NÃO são controladas
`appointments` não tem vínculo com `patient_contracts` (nenhuma coluna `contract`), e nada conta sessões realizadas contra `sessions_per_month`. Logo o sistema hoje não sabe se o paciente de 6 sessões usou 5 ou 8, nem barra a 7ª. Isso vale para TODOS os planos (4..24), não só o novo. Definir saldo, rollover, ABA = 3, avaliação = 1 e falta/remarcação exige decisão do dono; não implementado.

## Implementado (dormente, migration `20261105170100_contract_prepay_flag_overdue_view.sql`, NÃO aplicada)
- `patient_contracts.require_prepay boolean not null default false`: marcação, nada a lê para bloquear.
- View `v_contract_overdue_invoices` (security_invoker, somente leitura): contratos ativos com fatura `pendente/atrasado` e `due_date < hoje (America/Sao_Paulo)`, com `days_overdue`. Serve para a recepção consultar; sem tela nova nem automação.

## Desenho proposto (NÃO implementado)
1. **Cobrança antes do ciclo**: já ocorre no dia 1 (fatura gerada no vencimento `invoice_day=1`). Para "pagar antes", gerar a fatura de D-5 (job extra com `invoice_day` e `due_date` = último dia útil anterior ao ciclo) apenas para `require_prepay = true`. Corrigir `createContract` para gravar `invoice_day`.
2. **Marcar atraso**: job diário `update contract_invoices set status='atrasado' where status='pendente' and due_date < current_date` (hoje DRE/fluxo de caixa já tratam `atrasado` como aberto, sem efeito colateral).
3. **Aviso à recepção**: card em `/recepcao` lendo a view, ordenado por `days_overdue`. Para KPI (AGENTS.md), qualquer indicador exibido (ex.: faturas em atraso, R$ em atraso) deve ter comparativo (vs. mês anterior ou vs. meta); sem comparativo não entra como KPI. Dashboards seguem no próprio sistema, sem BI pago.
4. **Bloqueio de agenda** (só depois de 1-3 e do controle de sessões): para `require_prepay = true` com fatura vencida há mais de N dias, a recepção recebe alerta ao agendar e só gestor libera (override com motivo auditado). Bloqueio automático e silencioso NÃO recomendado.

## Riscos
- Bloquear atendimento de criança por inadimplência tem risco reputacional/clínico e possível questão contratual/CDC: exige regra escrita no contrato e liberação humana.
- Sem controle de sessões usadas, "6 sessões" é só valor de cobrança; excedente/saldo ficam fora do sistema.
- Marcar `atrasado` altera contagens em telas existentes (contas a receber/pendências): validar antes.
- Fuso: vencimento comparado em America/Sao_Paulo; job do cron roda em UTC.
- Pagamento manual sem gateway: atraso pode ser só falta de baixa; a view pode listar quem já pagou fora do sistema.
- Não tocar em Autorizações/duplicidade de 1ª avaliação (AGENTS.md item 3): este desenho não interage com `registration_drafts`.
