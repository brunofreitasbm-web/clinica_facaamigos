-- supabase/tests/006b_appointments_guard_provisional_fix_test.sql
--
-- Teste funcional do fix de 20260904000006b_appointments_guard_fix.sql.
-- Cobre o cenário Critical apontado em review: reconciliação de uma sessão
-- provisória (is_provisional true -> false) que mantém status='realizada' durante
-- o UPDATE inteiro (old.status = new.status = 'realizada') tem que continuar
-- rodando o guard (validar authorization_id/vigência/sessões e incrementar
-- sessions_used exatamente uma vez), em vez de pular silenciosamente.
begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000101', 'test-therapist-t6@example.com');

insert into clinics (id, name) values ('00000000-0000-0000-0000-000000000201', 'Clinica Teste T6');
insert into profiles (id, clinic_id, role, full_name) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'terapeuta', 'Terapeuta Teste');
insert into rooms (id, clinic_id, name) values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'Sala 1');
insert into patients (id, clinic_id, full_name, birth_date) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000201', 'Paciente Teste', '2018-01-01');
insert into patient_insurance (id, patient_id, is_private) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', true);
insert into authorizations (id, patient_insurance_id, procedure_code, sessions_authorized, sessions_used, valid_from, valid_to, status) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501', 'PROC1', 10, 0, '2026-01-01', '2026-12-31', 'ativa');

-- Cenário 1 (implícito) + base: insere sessão provisória já 'realizada' (sem
-- authorization_id) -> guard pulado por is_provisional=true, sessions_used intocado.
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional)
values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', 'ABA', '2026-09-10 10:00-03', '2026-09-10 11:00-03', 'realizada', true);

select is((select sessions_used from authorizations where id = '00000000-0000-0000-0000-000000000601'), 0,
  'insert provisional realizada nao incrementa sessions_used');

-- Cenário 3 (o que estava quebrado): reconcilia para is_provisional=false,
-- status permanece 'realizada' (old.status = new.status = 'realizada'),
-- authorization_id agora válido. Antes do fix 006b, o guard era pulado
-- inteiramente aqui (bypass). Depois do fix, guard roda e incrementa 1 vez.
update appointments set is_provisional = false, authorization_id = '00000000-0000-0000-0000-000000000601'
where id = '00000000-0000-0000-0000-000000000701';

select is((select sessions_used from authorizations where id = '00000000-0000-0000-0000-000000000601'), 1,
  'reconciliacao provisional->nao-provisional (status realizada->realizada) incrementa sessions_used exatamente uma vez (guard nao pula mais)');

-- Cenário 4: update que preserva status='realizada' e is_provisional inalterado
-- (ex.: só checkout_at) não deve reincrementar nem re-validar (sem falso-positivo).
update appointments set checkout_at = now() where id = '00000000-0000-0000-0000-000000000701';

select is((select sessions_used from authorizations where id = '00000000-0000-0000-0000-000000000601'), 1,
  'update preservando status e is_provisional nao reincrementa (sem falso-positivo)');

-- Confirma que o guard corrigido de fato valida (não é um bypass generalizado):
-- reconciliar outra sessão provisória sem authorization_id continua bloqueado.
insert into appointments (id, patient_id, therapist_id, room_id, discipline, starts_at, ends_at, status, is_provisional)
values ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', 'ABA', '2026-09-10 12:00-03', '2026-09-10 13:00-03', 'realizada', true);

select throws_ok(
  $$update appointments set is_provisional = false where id = '00000000-0000-0000-0000-000000000702'$$,
  'sessão realizada exige authorization_id (a menos que is_provisional)',
  'reconciliar sem authorization_id continua bloqueado (guard roda no cenario 3, nao eh bypass)'
);

select * from finish();
rollback;
