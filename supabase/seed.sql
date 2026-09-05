-- =====================================================================
-- Seed de Dados e Usuários de Teste - Clínica FaçaAmigos
-- =====================================================================

-- 1. Clínica Padrão de Teste
insert into public.clinics (id, name, cnpj)
values (
  '11111111-1111-1111-1111-111111111111',
  'Clínica FaçaAmigos TEA',
  '12.345.678/0001-90'
)
on conflict (id) do nothing;

-- 2. Salas da Clínica
insert into public.rooms (id, clinic_id, name, capacity)
values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Sala 01 - Integração Sensorial', 2),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Sala 02 - Psicológica / ABA', 1),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Sala 03 - Fonoaudiologia', 1)
on conflict (id) do nothing;

-- Nota: Os usuários auth.users devem ser criados via Supabase Auth (Dashboard
-- ou CLI), um por perfil (gestor, supervisor, terapeuta, recepção,
-- faturamento), cada um com e-mail e senha próprios definidos localmente por
-- quem for testar — ver docs/CREDENCIAIS_TESTE.md. Não versionar credenciais
-- aqui.
