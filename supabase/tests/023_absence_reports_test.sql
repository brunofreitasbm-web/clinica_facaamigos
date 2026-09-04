-- Item 5 do PRD "11 incrementos": fluxo "Informar Falta" pela família.
-- Cobre a auto-aprovação do trigger (doença) vs. análise manual (demais
-- categorias sem anexo), e a RLS de insert (só o responsável vinculado) e
-- de update (só recepção/supervisor/gestor resolve).
begin;
select plan(6);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000010', 'responsavel.absence@test.local'),
  ('a0000000-0000-0000-0000-000000000011', 'responsavel.outro.absence@test.local'),
  ('a0000000-0000-0000-0000-000000000012', 'recepcao.absence@test.local'),
  ('a0000000-0000-0000-0000-000000000013', 'terapeuta.absence@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Absence'),
  ('a0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'responsavel', 'Responsável Sem Vínculo'),
  ('a0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção Absence'),
  ('a0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta Absence')
on conflict do nothing;

insert into rooms (id, clinic_id, name) values ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Sala Absence');

insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Paciente Absence', '2018-01-01', 'ativo');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000010', 'responsavel');

insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status) values
  ('17000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000013',
   'b0000000-0000-0000-0000-000000000002', 'aba', now() + interval '1 day', now() + interval '1 day 1 hour', 'agendada'),
  ('17000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000013',
   'b0000000-0000-0000-0000-000000000002', 'aba', now() + interval '2 day', now() + interval '2 day 1 hour', 'agendada');

-- 1/2: categoria 'doenca' sem anexo -> auto-aprova e marca falta_familia
-- 3: categoria 'viagem' sem anexo -> fica em_analise, sessão não muda
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000010"}';
insert into absence_reports (id, appointment_id, reported_by, reason_category) values
  ('18000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000010', 'doenca');
insert into absence_reports (id, appointment_id, reported_by, reason_category) values
  ('18000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000010', 'viagem');
reset role;

-- 4: responsável sem vínculo ao paciente não consegue informar falta —
-- throws_ok precisa rodar ANTES do reset role (senão executa sem RLS).
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000011"}';
prepare bad_unlinked_report as
  insert into absence_reports (appointment_id, reported_by, reason_category)
  values ('17000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011', 'outro');
create temp table t_bad_unlinked_report as
  select throws_ok('bad_unlinked_report', null, null, 'responsável sem vínculo ao paciente não consegue informar falta') as v;
reset role;

-- 5: recepção resolve o chamado 'em_analise'
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000012"}';
update absence_reports set status = 'aprovado', resolved_by = 'a0000000-0000-0000-0000-000000000012', resolved_at = now()
  where id = '18000000-0000-0000-0000-000000000002';
reset role;

create temp table t_recepcao_resolved as
  select (status = 'aprovado') as v from absence_reports where id = '18000000-0000-0000-0000-000000000002';

-- 6: terapeuta (fora do conjunto de papéis autorizados) não resolve chamados
update absence_reports set status = 'em_analise', resolved_by = null, resolved_at = null
  where id = '18000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000013"}';
update absence_reports set status = 'aprovado' where id = '18000000-0000-0000-0000-000000000002';
reset role;

create temp table t_terapeuta_blocked as
  select (status = 'em_analise') as v from absence_reports where id = '18000000-0000-0000-0000-000000000002';

select ok(
  (select status from absence_reports where id = '18000000-0000-0000-0000-000000000001') = 'aprovado',
  'categoria doença sem anexo é auto-aprovada pelo trigger'
) as result
union all
select ok(
  (select status from appointments where id = '17000000-0000-0000-0000-000000000001') = 'falta_familia',
  'trigger marca a sessão como falta_familia quando auto-aprova'
)
union all
select ok(
  (select status from absence_reports where id = '18000000-0000-0000-0000-000000000002') = 'em_analise'
  and (select status from appointments where id = '17000000-0000-0000-0000-000000000002') = 'agendada',
  'categoria viagem sem anexo fica em_analise e não altera a sessão'
)
union all
select v from t_bad_unlinked_report
union all
select ok((select v from t_recepcao_resolved), 'recepção consegue aprovar um chamado em_analise')
union all
select ok((select v from t_terapeuta_blocked), 'terapeuta não consegue resolver um chamado (RLS bloqueia)');

rollback;
