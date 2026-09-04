-- supabase/migrations/20260904000025_resources.sql
-- Item 10 do PRD "11 incrementos": estoque e reserva de recursos físicos
-- (brinquedos sensoriais, testes padronizados, pranchas de comunicação).
-- Salas ficam FORA daqui de propósito: `rooms` (20260904000001) já tem seu
-- próprio mecanismo de exclusividade via appointments.room_id — duplicar
-- salas num `resources` genérico criaria dois sistemas de reserva
-- concorrentes para a mesma coisa.
--
-- Concorrência: mesmo idioma de appointments/therapist_contracts —
-- EXCLUDE USING GIST + tstzrange, sem locking em nível de aplicação.
create table resources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null,
  category text not null check (category in ('brinquedo_sensorial','teste_padronizado','prancha_comunicacao','outro')),
  notes text
);

create table resource_bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id),
  appointment_id uuid references appointments(id),
  booked_by uuid not null references profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'reservado' check (status in ('reservado','cancelado')),
  check (ends_at > starts_at),
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelado')
);

alter table resources enable row level security;
alter table resource_bookings enable row level security;

create policy resources_read on resources for select
  using (clinic_id = current_clinic_id());

-- Mesmo padrão de rooms_manage_by_supervisor_gestor (20260904000001):
-- cadastro de recurso é responsabilidade de gestão/supervisão.
create policy resources_manage_gestor_supervisor on resources for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'));

create policy resource_bookings_read on resource_bookings for select
  using (exists (select 1 from resources r where r.id = resource_bookings.resource_id and r.clinic_id = current_clinic_id()));

-- Qualquer papel operacional pode reservar um recurso pra uso próprio
-- (terapeuta reservando uma prancha pra sessão, recepção reservando um
-- teste padronizado para uma avaliação) — não é dado clínico do paciente,
-- é inventário interno da clínica.
create policy resource_bookings_insert on resource_bookings for insert
  with check (
    booked_by = auth.uid()
    and exists (select 1 from resources r where r.id = resource_id and r.clinic_id = current_clinic_id())
    and app_current_role() in ('gestor','supervisor','recepcao','terapeuta')
  );

-- Cancelar: quem reservou, ou recepção/supervisor/gestor (pra liberar um
-- recurso preso por alguém que esqueceu de cancelar).
create policy resource_bookings_update on resource_bookings for update
  using (
    exists (select 1 from resources r where r.id = resource_bookings.resource_id and r.clinic_id = current_clinic_id())
    and (booked_by = auth.uid() or app_current_role() in ('gestor','supervisor','recepcao'))
  );
