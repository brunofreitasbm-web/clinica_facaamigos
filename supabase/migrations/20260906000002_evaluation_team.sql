-- supabase/migrations/20260906000002_evaluation_team.sql
-- Módulo 3 MAAIS, slide 23 "Funções e responsabilidades na entrada de
-- clientes": supervisor geral/RT, supervisor de área, terapeutas. Hoje
-- `patient_access` só distinguia terapeuta/responsavel/supervisor no nível de
-- permissão — não registrava o PAPEL do vínculo dentro da equipe de
-- avaliação. Adiciona isso sem tocar em `access_type` (RLS de outras tabelas
-- depende dele).

alter table patient_access add column role_in_team text
  check (role_in_team in ('terapeuta_avaliador', 'supervisor_area', 'rt'));
alter table patient_access add column discipline text;

-- RT (Responsável Técnico) é uma qualificação do profissional, não um papel
-- de acesso — por isso é uma flag em profiles, e não um valor a mais no CHECK
-- de profiles.role (que teria efeito cascata em todas as políticas de RLS
-- que testam app_current_role()).
alter table profiles add column is_rt boolean not null default false;

comment on column patient_access.role_in_team is
  'Papel do profissional na equipe de avaliação deste paciente (slide 23) — null para vínculos que não são de equipe de avaliação (ex.: responsavel).';
comment on column patient_access.discipline is
  'Disciplina do terapeuta/supervisor de área nesta equipe (ex.: aba, fonoaudiologia) — livre, mesmo padrão de appointments.discipline.';

-- Conclui 'equipe_definida' quando o paciente tem pelo menos 1 terapeuta
-- avaliador e 1 supervisor de área com acesso ativo.
create function trg_patient_access_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $f$
declare
  v_patient_id uuid;
  has_terapeuta boolean;
  has_supervisor boolean;
begin
  v_patient_id := coalesce(new.patient_id, old.patient_id);

  select
    exists(select 1 from patient_access where patient_id = v_patient_id and role_in_team = 'terapeuta_avaliador' and revoked_at is null),
    exists(select 1 from patient_access where patient_id = v_patient_id and role_in_team = 'supervisor_area' and revoked_at is null)
  into has_terapeuta, has_supervisor;

  if has_terapeuta and has_supervisor then
    perform set_intake_step_complete(v_patient_id, 'equipe_definida');
  end if;

  return coalesce(new, old);
end;
$f$;

create trigger patient_access_intake_sync
  after insert or update or delete on patient_access
  for each row execute function trg_patient_access_intake_sync();
