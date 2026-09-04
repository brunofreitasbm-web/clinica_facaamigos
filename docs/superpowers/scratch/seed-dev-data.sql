insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'gestor@facaamigos.dev'),
  ('c1000000-0000-0000-0000-000000000002', 'terapeuta.ana@facaamigos.dev'),
  ('c1000000-0000-0000-0000-000000000003', 'terapeuta.bruno@facaamigos.dev')
on conflict do nothing;

insert into clinics (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'FaçaAmigos')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'gestor', 'Bruno Freitas', true),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Ana Souza', true),
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'terapeuta', 'Bruno Lima', true)
on conflict do nothing;

insert into rooms (id, clinic_id, name, capacity) values
  ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sala 1', 1),
  ('c2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Sala 2', 1)
on conflict do nothing;
