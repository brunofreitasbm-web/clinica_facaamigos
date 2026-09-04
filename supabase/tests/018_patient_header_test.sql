-- Item 1 do PRD "11 incrementos": header de identificação do paciente.
-- Cobre a única regra nova de banco (no máximo 1 contato de emergência por
-- paciente) — convênio/carteirinha reaproveitam patient_insurance/insurers
-- já testados em 003_insurance_test.sql.
begin;
select plan(2);

insert into clinics (id, name) values ('c0000000-0000-0000-0000-000000000001', 'Clínica Teste') on conflict do nothing;
insert into patients (id, clinic_id, full_name, birth_date, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Paciente A', '2018-01-01', 'ativo');

insert into guardians (id, patient_id, full_name, phone, is_emergency_contact) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mãe', '11999999999', true);

select ok(
  (select is_emergency_contact from guardians where id = 'e0000000-0000-0000-0000-000000000001'),
  'primeiro responsável marcado como contato de emergência é salvo'
);

prepare bad_second_emergency_contact as
  insert into guardians (patient_id, full_name, phone, is_emergency_contact)
  values ('d0000000-0000-0000-0000-000000000001', 'Pai', '11988888888', true);
select throws_ok(
  'bad_second_emergency_contact',
  '23505',
  null,
  'segundo contato de emergência marcado para o mesmo paciente é rejeitado (índice único parcial)'
);

select * from finish();
rollback;
