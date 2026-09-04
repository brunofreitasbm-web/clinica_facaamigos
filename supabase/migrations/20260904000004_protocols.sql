create table domain_taxonomy (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  discipline text not null,
  domain text not null,
  description text
);

create table protocols (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  name text not null check (name in ('vbmapp','ablls_r','esdm')),
  version text,
  license_purchased_at date,
  license_note text,
  digitization_risk_accepted_by uuid not null references profiles(id),
  digitization_risk_accepted_at timestamptz not null,
  unique (clinic_id, name)
);

create table protocol_items (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id),
  domain text not null,
  level text,
  item_code text not null,
  description text not null
);

create table protocol_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  protocol_id uuid not null references protocols(id),
  assessed_at timestamptz not null default now(),
  assessed_by uuid not null references profiles(id),
  scores jsonb not null default '{}'::jsonb
);

alter table domain_taxonomy enable row level security;
alter table protocols enable row level security;
alter table protocol_items enable row level security;
alter table protocol_assessments enable row level security;

-- terapeuta certificado no instrumento correspondente: hoje só ESDM exige certificação (profiles.esdm_certified)
create function is_certified_for_protocol(p_protocol_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p.name = 'esdm' then coalesce((select esdm_certified from profiles where id = auth.uid()), false)
    else true
  end
  from protocols p where p.id = p_protocol_id;
$$;

create policy domain_taxonomy_read on domain_taxonomy for select
  using (clinic_id = current_clinic_id());
create policy domain_taxonomy_manage on domain_taxonomy for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('supervisor','gestor'));

create policy protocols_read on protocols for select
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor','terapeuta'));
create policy protocols_manage on protocols for all
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

-- §9.4-A: leitura só supervisor/gestor e terapeuta certificado; nunca recepção, faturamento, família
-- protocol_items NÃO tem clinic_id direto: JOIN obrigatório até protocols.clinic_id
create policy protocol_items_read on protocol_items for select
  using (
    (app_current_role() in ('gestor','supervisor')
    or (app_current_role() = 'terapeuta' and is_certified_for_protocol(protocol_id)))
    and exists (select 1 from protocols p where p.id = protocol_items.protocol_id and p.clinic_id = current_clinic_id())
  );
create policy protocol_items_manage on protocol_items for all
  using (
    app_current_role() in ('gestor','supervisor')
    and exists (select 1 from protocols p where p.id = protocol_items.protocol_id and p.clinic_id = current_clinic_id())
  );

-- protocol_assessments NÃO tem clinic_id direto: JOIN obrigatório até patients.clinic_id
create policy protocol_assessments_read on protocol_assessments for select
  using (
    (app_current_role() in ('gestor','supervisor')
    or (app_current_role() = 'terapeuta' and has_patient_access(patient_id, array['terapeuta']) and is_certified_for_protocol(protocol_id)))
    and exists (select 1 from patients pt where pt.id = protocol_assessments.patient_id and pt.clinic_id = current_clinic_id())
  );
create policy protocol_assessments_write on protocol_assessments for insert
  with check (
    app_current_role() in ('terapeuta','supervisor')
    and is_certified_for_protocol(protocol_id)
    and exists (select 1 from patients pt where pt.id = protocol_assessments.patient_id and pt.clinic_id = current_clinic_id())
  );
