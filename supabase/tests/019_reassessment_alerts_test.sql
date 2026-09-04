-- Item 2 do PRD "11 incrementos": ciclo de reavaliação semestral.
-- Cobre refresh_reassessment_alerts() (cálculo + notificação) e a RLS de
-- reassessment_alerts (só quem tem patient_access/gestor/supervisor vê).
begin;
select plan(5);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000002', 'terapeuta.a@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'terapeuta.b@test.local')
on conflict do nothing;

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name) values
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta A'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Terapeuta B')
on conflict do nothing;

-- Paciente admitido hoje: due_date ~ 6 meses no futuro, fora da janela de
-- 30 dias de antecedência — deve ficar 'pendente', sem mensagem.
insert into patients (id, clinic_id, full_name, birth_date, status, first_session_at) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Paciente longe', '2018-01-01', 'ativo', now());

-- Paciente admitido há ~5 meses e 10 dias: due_date ~ 20 dias no futuro,
-- dentro da janela padrão de 30 dias — deve virar 'notificado' + mensagem.
insert into patients (id, clinic_id, full_name, birth_date, status, first_session_at) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Paciente perto', '2018-01-01', 'ativo', now() - interval '5 months 10 days');

insert into patient_access (patient_id, profile_id, access_type) values
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'terapeuta');

select refresh_reassessment_alerts();

select ok(
  (select status from reassessment_alerts where patient_id = 'd0000000-0000-0000-0000-000000000001') = 'pendente',
  'paciente fora da janela de antecedência fica pendente'
);

select ok(
  (select status from reassessment_alerts where patient_id = 'd0000000-0000-0000-0000-000000000002') = 'notificado',
  'paciente dentro da janela de antecedência é notificado'
);

select ok(
  exists (
    select 1 from messages
    where patient_id = 'd0000000-0000-0000-0000-000000000002'
      and template_key = 'reavaliacao_semestral'
  ),
  'mensagem de reavaliação é registrada para o paciente notificado'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select ok(
  exists (select 1 from reassessment_alerts where patient_id = 'd0000000-0000-0000-0000-000000000002'),
  'terapeuta com patient_access enxerga o alerta do paciente vinculado'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';
select is_empty(
  $$ select 1 from reassessment_alerts where patient_id = 'd0000000-0000-0000-0000-000000000002' $$,
  'terapeuta sem patient_access não enxerga o alerta'
);
reset role;

select * from finish();
rollback;
