-- Continuação do rename PEI/PDI → PTS: o tipo de reunião "revisao_pdi"
-- (20260906000004_meetings_and_bonding.sql) também usava a sigla antiga.

alter table meetings drop constraint meetings_kind_check;
update meetings set kind = 'revisao_pts' where kind = 'revisao_pdi';
alter table meetings add constraint meetings_kind_check
  check (kind in ('interdisciplinar', 'devolutiva', 'revisao_pts', 'visita_escolar'));
