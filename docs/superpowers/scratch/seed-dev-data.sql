insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'gestor@facaamigos.com.br'),
  ('c1000000-0000-0000-0000-000000000002', 'terapeuta.ana@facaamigos.com.br'),
  ('c1000000-0000-0000-0000-000000000003', 'terapeuta.bruno@facaamigos.com.br')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'FaçaAmigos')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'gestor', 'Bruno Freitas', true),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Ana Souza', true),
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Bruno Lima', true)
on conflict do nothing;

-- 23 salas, capacidade 5 (regra recomendada do estágio: 1 estagiário por
-- criança, daí recommended_interns = capacity). Especialidade fica em branco
-- de propósito — definida depois, sala a sala, pelo editar em
-- /gestor/cadastros/salas. Sala 01 é a Sala de Avaliação: aqui ela é criada
-- com capacidade 5 mesmo com a flag is_evaluation_room ligada, ignorando de
-- propósito a trava de capacidade 1 que a UI/actions.ts aplicam nesse caso —
-- ajustar depois em Configurações se for pra valer a trava.
insert into rooms (id, clinic_id, name, capacity, recommended_interns, is_evaluation_room, is_aba_training) values
  ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala de Avaliação', 5, 5, true, false),
  ('c2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Sala de Treino', 5, 5, false, true),
  ('c2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Sala 03', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Sala 04', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Sala 05', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'Sala 06', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'Sala 07', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'Sala 08', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', 'Sala 09', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'Sala 10', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'Sala 11', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'Sala 12', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 'Sala 13', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000001', 'Sala 14', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000001', 'Sala 15', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000001', 'Sala 16', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000001', 'Sala 17', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000001', 'Sala 18', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000001', 'Sala 19', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000001', 'Sala 20', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000001', 'Sala 21', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000001', 'Sala 22', 5, 5, false, false),
  ('c2000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000001', 'Sala 23', 5, 5, false, false)
on conflict (id) do update set
  name = excluded.name,
  capacity = excluded.capacity,
  recommended_interns = excluded.recommended_interns,
  is_evaluation_room = excluded.is_evaluation_room,
  is_aba_training = excluded.is_aba_training;

insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000004', 'recepcao@facaamigos.com.br')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção FaçaAmigos', true)
on conflict do nothing;
