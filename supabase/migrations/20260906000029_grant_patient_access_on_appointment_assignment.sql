-- Achado: activatePatient (app/recepcao/pacientes/[id]/stage-actions.ts)
-- cria a primeira sessão de tratamento do paciente com um terapeuta, mas
-- nunca concede `patient_access` a ele — a RLS de prontuário
-- (has_patient_access) continua negando esse terapeuta, mesmo ele estando
-- na agenda pra atender. O mesmo vale pra qualquer sessão avulsa criada
-- pela recepção (createAppointment) ou pra avaliação (scheduleEvaluation).
--
-- Em vez de replicar essa concessão em cada server action (e esbarrar na
-- RLS de patient_access, que só libera escrita pra supervisor/gestor —
-- correto pra gestão manual de equipe, ver addTeamMember), resolve na
-- borda: um terapeuta escalado numa sessão ganha acesso ao prontuário
-- daquele paciente automaticamente. `role_in_team` fica null de propósito
-- (não conta pra 'equipe_definida', que exige terapeuta_avaliador +
-- supervisor_area concedidos deliberadamente via addTeamMember — ver
-- trg_patient_access_intake_sync em 20260906000002_evaluation_team.sql).
create or replace function trg_grant_patient_access_on_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.therapist_id is not null and not exists (
    select 1 from patient_access
    where patient_id = new.patient_id
      and profile_id = new.therapist_id
      and access_type = 'terapeuta'
      and revoked_at is null
  ) then
    insert into patient_access (patient_id, profile_id, access_type, discipline)
    values (new.patient_id, new.therapist_id, 'terapeuta', new.discipline);
  end if;
  return new;
end;
$$;

drop trigger if exists grant_patient_access_on_appointment on appointments;
create trigger grant_patient_access_on_appointment
  after insert on appointments
  for each row execute function trg_grant_patient_access_on_appointment();

revoke execute on function trg_grant_patient_access_on_appointment() from public, anon, authenticated;
