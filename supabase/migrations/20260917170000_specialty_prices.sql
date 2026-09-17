-- supabase/migrations/20260917170000_specialty_prices.sql
-- Tabela particular de valores (Diretrizes de Atendimento Particular
-- passadas pela clínica): o preço varia por ESPECIALIDADE, não por duração.
-- Reaproveita o catálogo `specialties` (20260907180000) como chave —
-- diferente de `insurer_price_tables` (20260904000003), que é por
-- convênio+procedure_code e exige janela de validade; aqui é o preço à
-- vista/particular, editável pelo gestor em
-- app/gestor/cadastros/precos-particulares.
create table specialty_prices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  specialty_value text not null,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes int not null default 40 check (duration_minutes between 10 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, specialty_value),
  foreign key (clinic_id, specialty_value) references specialties(clinic_id, value) on update cascade
);

alter table specialty_prices enable row level security;

-- Leitura pela clínica inteira: a tabela alimenta tanto a tela de contratos
-- (cálculo do pacote) quanto o bloco de conhecimento do chatbot
-- (lib/twilio-faq-bot.ts), que roda com o client admin, então a policy de
-- leitura em si só importa para as telas internas.
create policy specialty_prices_read on specialty_prices for select
  using (clinic_id = (select current_clinic_id()));

create policy specialty_prices_manage_ins on specialty_prices for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = 'gestor');
create policy specialty_prices_manage_upd on specialty_prices for update
  using (clinic_id = (select current_clinic_id())
         and (select app_current_role()) = 'gestor')
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = 'gestor');

create index idx_specialty_prices_clinic_active
  on specialty_prices (clinic_id, active);

-- Sessões por pacote mensal padrão (10, conforme a diretriz de atendimento
-- particular). Editável em app/gestor/cadastros/precos-particulares.
alter table clinics add column if not exists default_sessions_per_month int not null default 10
  check (default_sessions_per_month between 1 and 60);

-- Especialidades que a diretriz cita e ainda não existiam no catálogo.
-- ABA (psicologia_aba/fonoaudiologia/terapia_ocupacional) já existe.
insert into specialties (clinic_id, value, label, sort_order)
select c.id, v.value, v.label, v.ord
from clinics c
cross join (values
  ('psicoterapia', 'Psicoterapia', 9),
  ('fono_convencional', 'Fonoaudiologia Convencional', 10),
  ('to_convencional', 'Terapia Ocupacional Convencional', 11),
  ('integracao_sensorial', 'Integração Sensorial', 12),
  ('psicomotricidade', 'Psicomotricidade', 13)
) as v(value, label, ord)
on conflict (clinic_id, value) do nothing;

-- Tabela de valores particulares (Psicologia/Fono/TO ABA R$200 · 40min;
-- Psicoterapia/Fono/TO convencional R$150; Integração Sensorial,
-- Musicoterapia e Psicomotricidade R$200 · 40min; só Psicoterapia é 30min).
insert into specialty_prices (clinic_id, specialty_value, price, duration_minutes)
select c.id, v.specialty_value, v.price, v.duration_minutes
from clinics c
cross join (values
  ('psicologia_aba', 200.00, 40),
  ('fonoaudiologia', 200.00, 40),
  ('terapia_ocupacional', 200.00, 40),
  ('psicoterapia', 150.00, 30),
  ('fono_convencional', 150.00, 40),
  ('to_convencional', 150.00, 40),
  ('integracao_sensorial', 200.00, 40),
  ('musicoterapia', 200.00, 40),
  ('psicomotricidade', 200.00, 40)
) as v(specialty_value, price, duration_minutes)
on conflict (clinic_id, specialty_value) do nothing;

-- Tipo de atendimento "Psicoterapia (30 min)" — os demais appointment_types
-- já cobrem 40min; este é o único com duração diferente citado na diretriz.
insert into appointment_types (clinic_id, name, modality, duration_minutes, display_interval_minutes, recurrence)
select c.id, 'Psicoterapia (30 min)', 'presencial', 30, 30, 'semanal'
from clinics c
where not exists (
  select 1 from appointment_types at where at.clinic_id = c.id and at.name = 'Psicoterapia (30 min)'
);
