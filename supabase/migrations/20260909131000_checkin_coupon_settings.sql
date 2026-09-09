-- Cupom de check-in (80mm, não-fiscal): impresso automaticamente quando a
-- recepção dá check-in num paciente, mostrando a linha do tempo das sessões
-- daquele dia (sala · terapia · terapeuta · período). Configurável em
-- /gestor/configuracoes/cupom-checkin.
--
-- Uma linha por clínica (`clinic_id` único) — é configuração de área, não
-- catálogo, mesmo desenho de `evaluation_appointment_priorities` sendo
-- singleton por outro motivo. A leitura (lib/checkin-coupon.ts,
-- couponSettingsFromRow) nunca depende de a linha existir: `maybeSingle()`
-- ausente cai nos DEFAULT_COUPON_SETTINGS, então uma clínica sem linha (ou
-- sem permissão de leitura) simplesmente não imprime nada, em vez de quebrar.

create table checkin_coupon_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references clinics(id) on delete cascade,

  enabled boolean not null default true,
  -- 'primeiro' = só no 1º check-in do dia do paciente (padrão);
  -- 'todos'    = a cada check-in; 'manual' = nunca imprime sozinho.
  trigger_mode text not null default 'primeiro'
    check (trigger_mode in ('primeiro', 'todos', 'manual')),
  paper_width_mm smallint not null default 80
    check (paper_width_mm in (58, 80)),

  header_text text not null default '',
  footer_text text not null default '',

  show_logo boolean not null default true,
  show_clinic_name boolean not null default true,
  show_patient_name boolean not null default true,
  show_ticket_label boolean not null default true,
  show_checkin_time boolean not null default true,
  show_room boolean not null default true,
  show_discipline boolean not null default true,
  show_therapist boolean not null default true,
  show_time_range boolean not null default true,
  show_warnings boolean not null default true,
  show_printed_at boolean not null default true,

  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table checkin_coupon_settings enable row level security;

create policy checkin_coupon_settings_read on checkin_coupon_settings for select
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor', 'supervisor', 'recepcao')
  );

-- Policies separadas por comando em vez de `for all`, seguindo
-- 20260905123903_consolidate_manage_policies_perf.sql: um `for all` vira
-- policy permissiva extra no SELECT e o advisor reclama.
create policy checkin_coupon_settings_manage_ins on checkin_coupon_settings for insert
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) = 'gestor');
create policy checkin_coupon_settings_manage_upd on checkin_coupon_settings for update
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) = 'gestor')
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) = 'gestor');

create index idx_checkin_coupon_settings_updated_by on checkin_coupon_settings (updated_by);

insert into checkin_coupon_settings (clinic_id, header_text, footer_text)
select c.id, c.name, 'Guarde este comprovante. Bom atendimento!'
from clinics c
on conflict (clinic_id) do nothing;
