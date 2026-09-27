# Módulo Financeiro HUB (Playground + Circuito + Clínica)

Construído em 27/09/2026. Vive dentro deste app (`/gestor/financeiro-hub`),
não no repo da Landing Page — decisão tomada porque reaproveita o login,
a sessão e o papel `gestor` que já existem aqui, sem nenhuma chamada de
autenticação entre projetos.

**Nada disto foi aplicado em produção ainda.** Só está no código local
deste repositório.

## Acesso

- Rota **não linkada** em nenhum menu (`GestorNav` etc.) — só quem tem a
  URL entra, e mesmo assim só quem é `gestor` passa pelo middleware
  (`lib/roles.ts` → `ROLE_ALLOWED_PREFIXES`; `gestor` não tem prefixo
  restrito, acessa tudo).
- Login é o mesmo de sempre: CPF ou e-mail + senha, na tela `/login`.
- **Decisão tomada com o usuário (27/09):** a conta de CPF de Isabella
  (hoje `terapeuta`) passa a `gestor` — ver
  `supabase/migrations/20260927140100_fa_finance_hub_isabella_gestor.sql`.
  Efeito colateral aceito: ela passa a acessar todo o `/gestor`, não só o
  financeiro.

## O que fica automático vs. manual

| | Playground / Circuito | Clínica |
|---|---|---|
| Receita | ao vivo, do PDV (`fa_kiosk_orders/_items/_payments`, projeto `ivjvpdzsfjdpyabbzzuj`) | ao vivo, de `billing_items` (convênio) + `patient_charges` (particular) |
| Custo direto / repasse | manual | ao vivo, de `payouts` |
| Despesas operacionais | manual | ao vivo, de `accounts_payable` |
| Impostos, depreciação, financeiro, aportes/retiradas | manual (as 3 unidades) | manual |
| Balanço Patrimonial (todo ele) | manual | manual |

Nenhum dos três sistemas controla ativo/passivo — o Balanço é 100%
lançamento manual, mês a mês, por unidade.

## Para colocar em produção

1. Rodar as duas migrations (nesta ordem):
   - `supabase/migrations/20260927140000_fa_finance_hub.sql`
   - `supabase/migrations/20260927140100_fa_finance_hub_isabella_gestor.sql`
     (confirme antes que é a Isabella certa — o `WHERE` já filtra por
     `full_name = 'Isabella Freitas' and cpf is not null and role =
     'terapeuta'`, mas vale um `select` antes de rodar o `update`).
2. Configurar no Vercel deste projeto (Settings → Environment Variables):
   - `POS_SUPABASE_URL=https://ivjvpdzsfjdpyabbzzuj.supabase.co`
   - `POS_SUPABASE_SERVICE_ROLE_KEY=<service role key do projeto
     ivjvpdzsfjdpyabbzzuj>` — pegue em
     supabase.com/dashboard/project/ivjvpdzsfjdpyabbzzuj/settings/api-keys.
     Sem isso, as telas mostram "não disponível" pra Playground/Circuito
     em vez de quebrar — não é bloqueante, mas fica sem os números certos.
3. Depois de aplicar a migration, regerar `lib/database.types.ts`
   (`supabase gen types`) e trocar os `AnySupabase`/`any` documentados em
   `lib/finance-hub/repo.ts` e `lib/finance-hub/balanco.ts` pelos tipos
   reais — hoje as tabelas `fa_fin_*` não existem no arquivo gerado.
4. Testar o login de Bruno e de Isabella em `/gestor/financeiro-hub`.

## Limitações conhecidas (v1)

- **Playground vs. Circuito no PDV:** as duas ficam na mesma unidade do
  PDV (`fa_kiosk_units`); a separação usa `fa_kiosk_sessions.activity`
  (`PLAYGROUND` vs. `CARRINHO`). Venda de produto no balcão
  (`item_nature='PRODUTO'`, sem sessão) entra toda no Playground — não há
  como saber qual fila vendeu.
- **DRE da Clínica aqui é em regime de caixa** (usa `paid_at`), diferente
  do DRE por competência que já existe em `/gestor/financeiro/dre`
  (`getDreByMonth`, baseado em `v_contribution_margin`). São dois números
  diferentes de propósito — o daqui alimenta o Fluxo de Caixa.
- **Fluxo de Investimento não é modelado** (compra de imobilizado,
  empréstimo tomado/quitado) — hoje entra como "Ajuste manual" com nota
  explicando o quê, sem seção própria.
- **`contract_invoices`/mensalidade recorrente** não existe nas migrations
  deste repo hoje — se for criada depois, a receita particular da Clínica
  (`getClinicaMonthlyFigures`) precisa somar essa fonte também.
