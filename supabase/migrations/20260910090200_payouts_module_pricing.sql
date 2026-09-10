-- Estende payouts/payout_items para honorários por Módulo Assistencial
-- entregue + indenização por esvaziamento por falta, preservando as linhas
-- históricas do modelo por hora/sessão intactas (item_type default
-- 'sessao', sem migração de dados retroativa).
alter table payouts
  add column modules_delivered_count int not null default 0,
  add column modules_emptied_noshow_count int not null default 0,
  add column indemnity_amount numeric(10,2) not null default 0;

comment on column payouts.modules_delivered_count is
  'Nº de Módulos Assistenciais entregues na competência (modelo novo). Para linhas históricas do modelo por hora, fica 0.';
comment on column payouts.indemnity_amount is
  'Indenização civil por módulos esvaziados por falta com aviso <24h (cláusula 6.7) — discriminada de gross_amount, nunca somada por dentro, para aparecer separada em extrato/CSV.';

alter table payout_items
  add column item_type text not null default 'sessao'
    check (item_type in ('sessao', 'modulo', 'indenizacao_noshow')),
  add column service_date date,
  add column period text check (period in ('matutino', 'vespertino')),
  add column module_price_applied numeric(10,2),
  add column appointment_ids uuid[],
  alter column appointment_id drop not null;

comment on column payout_items.item_type is
  '''sessao'' = linha histórica do modelo por hora (1:1 com appointment_id). ''modulo''/''indenizacao_noshow'' = modelo por Módulo Assistencial, referenciam vários atendimentos via appointment_ids.';
comment on column payout_items.appointment_id is
  'Legado — usado só por item_type=''sessao''. Itens de módulo/indenização usam appointment_ids (array).';
