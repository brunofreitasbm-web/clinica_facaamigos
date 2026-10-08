# Incidente de Disk I/O no Postgres compartilhado (2026-10-08)

O Supabase (compute Micro, baseline de 500 IOPS) caiu por esgotamento de Disk I/O.
O banco é compartilhado com outro app. Este documento resume as causas tratadas
no repositório e o procedimento **manual** de limpeza. Nada aqui foi executado em produção.

## O que foi corrigido no código/migrations

| Causa | Correção | Onde |
|---|---|---|
| Geração de recorrência sem limite (horizonte avançava 8 semanas por dia) | cron passa a gerar só até hoje + 8 semanas | `20261008120200_bound_grade_recurrence_horizon.sql` |
| Sem índice para `auto_resolve_appointments` (288 execuções/dia) | índices parciais + predicado indexável | `20261008120000_db_io_indexes_auto_resolve.sql` |
| Jobs de extração/intake a cada minuto | a cada 5 min (comando/segredo do Vault preservados) | `20261008120100_...` |
| `audit_log`, `ux_events`, `cron.job_run_details`, `net._http_response` sem retenção | job diário 07:00 UTC `db_retention_daily` | `20261008120100_...` |
| Polling agressivo no cliente | intervalos maiores, pausa com aba oculta, debounce | `app/recepcao/...`, `components/bonus-floating-widget.tsx` |
| Webhook do Google Calendar potencialmente em loop | guarda por `type`/`old_record` | `supabase/functions/sync-google-calendar` |

## Ordem de aplicação em produção

1. **Antes de tudo**: rodar `docs/runbooks/db-io-diagnostics.sql` (consultas 1, 2b, 3) e anotar os números.
2. Se `appointments` ou `audit_log` forem grandes, criar os índices manualmente com
   `CREATE INDEX CONCURRENTLY` (comandos no cabeçalho da migration `20261008120000`), fora de transação.
3. Aplicar `20261008120200` primeiro (para o cron das 04:00 UTC parar de crescer a tabela), depois `...120000` e `...120100`.
   A migration de índices usa `lock_timeout = 5s`: se falhar por lock, repetir em horário calmo.
4. Só então executar a limpeza abaixo (se necessária).

## Limpeza do excesso de sessões futuras (manual)

Objetivo: remover sessões **futuras, ainda `agendada`, sem qualquer vínculo** que ultrapassem hoje + 8 semanas.
**Não apagar nada sem antes rodar o dry-run e conferir os números com a recepção/supervisão.**
Fazer backup/snapshot antes. Rodar em horário de baixo movimento.

### 1) Dry-run (somente contagem)

```sql
with limite as (select (now() at time zone 'America/Sao_Paulo')::date + 56 as d)
select count(*) as a_remover, min(a.starts_at), max(a.starts_at)
from public.appointments a, limite
where a.recurrence_id is not null
  and a.status = 'agendada'
  and a.checkin_at is null and a.confirmed_at is null
  and (a.starts_at at time zone 'America/Sao_Paulo')::date > limite.d;
```

Conferir também se existem referências (faturamento, notas, check-in QR, `swap`, etc.) a essas linhas:
listar as tabelas com FK para `appointments` (`\d+ appointments` ou `information_schema.table_constraints`)
e contar referências para o conjunto acima. Qualquer linha referenciada fica de fora.

### 2) Execução em lotes (somente após conferir o dry-run)

Rodar **repetidamente** até retornar 0 (cada execução é uma transação curta; cada DELETE também grava no `audit_log`, então lotes pequenos):

```sql
with limite as (select (now() at time zone 'America/Sao_Paulo')::date + 56 as d),
alvo as (
  select a.id from public.appointments a, limite
  where a.recurrence_id is not null
    and a.status = 'agendada'
    and a.checkin_at is null and a.confirmed_at is null
    and (a.starts_at at time zone 'America/Sao_Paulo')::date > limite.d
    and not exists (select 1 from public.checkin_requests cr
                    where cr.appointment_id = a.id or a.id = any(cr.candidate_appointment_ids))
  order by a.starts_at desc
  limit 2000
)
delete from public.appointments where id in (select id from alvo)
returning 1;
```

Se alguma FK impedir o DELETE, o erro é esperado: **não** usar CASCADE nem desabilitar triggers; reportar e tratar caso a caso.
Alternativa menos destrutiva: marcar como `cancelada_clinica` com `cancel_reason = 'excesso de geração automática'` (mas isso mantém as linhas).

### 3) Pós-limpeza

- `VACUUM (ANALYZE) public.appointments;` (não bloqueia; evitar horário de pico).
- Reexecutar as consultas 1 e 3 do diagnóstico para confirmar `semanas_a_frente <= 8` e o novo tamanho.
- Backlog antigo de `audit_log`: `db_retention_daily` apaga no máximo 10.000 linhas por dia. Se o backlog for grande,
  chamar manualmente `select maintenance_purge_old_data(365, 10000);` repetidas vezes em horário calmo, ou aumentar o lote.

## Ações do dono do projeto (fora do repositório)

- **Rotacionar o segredo do webhook `sync-grupoib-professional`**: o valor antigo estava no código (histórico git) e deve ser tratado como vazado.
  Definir `GRUPOIB_WEBHOOK_SECRET` (secrets das Edge Functions) e atualizar o header `X-Webhook-Secret` do Database Webhook **antes** do deploy da função (sem a env a função responde 401).
- Conferir no painel do Supabase se o Database Webhook de `appointments` → `sync-google-calendar` dispara em UPDATE (se sim, o loop era real; a guarda nova o interrompe).
- Retenção de `audit_log` assumida em 365 dias (nenhum prazo documentado no repositório). Confirmar com jurídico/DPO.
