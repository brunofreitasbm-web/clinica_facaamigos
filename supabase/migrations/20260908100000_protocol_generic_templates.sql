-- supabase/migrations/20260908100000_protocol_generic_templates.sql
-- Protocolos genéricos configuráveis (estrutura sem licença), semeados a
-- partir de lib/protocol-templates/. Levantamento jurídico por instrumento em
-- docs/protocolos-genericos-fontes.md.
--
-- `is_validated` (20260906000005) nunca foi lido nem escrito; fica como está
-- e é substituído semanticamente por `is_generic` (false = protocolo
-- licenciado cadastrado à mão, fluxo original).
--
-- `digitization_risk_accepted_by/at` continuam NOT NULL (supabase/tests/
-- 004_protocols_test.sql): no fluxo genérico registram quem aceitou o termo
-- de "estrutura genérica de autoria própria, não reprodução do instrumento".

alter table protocols add column is_generic boolean not null default false;
alter table protocols add column template_version text;
alter table protocols add column scale jsonb;

comment on column protocols.is_generic is
  'true = estrutura genérica semeada de lib/protocol-templates (sem licença); false = protocolo licenciado digitado pelo gestor.';
comment on column protocols.template_version is
  'Versão do template de lib/protocol-templates usado na semeadura (null para protocolos licenciados).';
comment on column protocols.scale is
  'Escala de pontuação do protocolo: {"max": 4, "labels": {"0": "…", "4": "…"}}. null = escala padrão 0/1/2 (ASSESSMENT_SCORE_LABEL).';

alter table protocol_items add column sort_order integer not null default 0;
alter table protocol_items add column weight numeric not null default 1;
alter table protocol_items add column inverted boolean not null default false;

comment on column protocol_items.sort_order is
  'Ordem de exibição dentro do protocolo (templates preservam a ordem dos domínios/níveis do instrumento).';
comment on column protocol_items.weight is
  'Peso do item no total do domínio (ex.: DEMUCA usa 2 em cinco itens). Default 1.';
comment on column protocol_items.inverted is
  'true = pontuação alta significa pior (ex.: comportamentos restritivos); o cálculo de % inverte o valor.';

create index protocol_items_protocol_sort_idx on protocol_items (protocol_id, sort_order);
