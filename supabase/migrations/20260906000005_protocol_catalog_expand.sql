-- supabase/migrations/20260906000005_protocol_catalog_expand.sql
-- Módulo 3 MAAIS, slides 24-25: a avaliação inicial cobre 7 áreas (cognitiva,
-- psicomotora, comportamental, linguística, funcional, nutricional, musical)
-- com protocolos próprios (AFLS, IPO, ABLA-R, Socially Savvy, PEP-R, TGMD-2,
-- ADL2, ABFW, COPM, Escala Labirinto, DEMUCA, entre outros). O CHECK
-- (name in ('vbmapp','ablls_r','esdm')) travava o cadastro a só 3
-- instrumentos. A lista de nomes válidos passa a ser mantida em
-- lib/protocol-catalog.ts (validada na Server Action, não no banco) — mais
-- fácil de estender do que uma migration a cada protocolo novo.

alter table protocols drop constraint protocols_name_check;
alter table protocols add column area text;
alter table protocols add column display_name text;
alter table protocols add column is_validated boolean not null default true;

comment on column protocols.area is
  'Área de avaliação do slide 24: cognitiva, psicomotora, comportamental, linguistica, funcional, nutricional, musical.';
comment on column protocols.display_name is
  'Nome de exibição do protocolo (ex.: "VB-MAPP") — protocols.name continua o slug técnico usado por is_certified_for_protocol().';
