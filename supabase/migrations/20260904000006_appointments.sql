-- supabase/migrations/20260904000006_appointments.sql
create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  therapist_id uuid not null references profiles(id),
  room_id uuid not null references rooms(id),
  authorization_id uuid references authorizations(id),
  discipline text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  modality text not null default 'individual' check (modality in ('individual','grupo','escola','remoto')),
  group_id uuid,
  recurrence_id uuid,
  status text not null default 'agendada'
    check (status in ('agendada','confirmada','realizada','falta_familia','cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')),
  cancel_reason text,
  cancelled_by uuid references profiles(id),
  cancelled_at timestamptz,
  confirmed_at timestamptz,
  confirmed_via text,
  checkin_at timestamptz,
  checkout_at timestamptz,
  is_provisional boolean not null default false,
  is_evaluation boolean not null default false,
  check (ends_at > starts_at),
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')),
  exclude using gist (
    therapist_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada'))
);

alter table appointments enable row level security;

-- NOTA (fix aplicado sobre o brief): a validação de vigência/sessões restantes e o
-- incremento de sessions_used só devem rodar na TRANSIÇÃO de entrada em 'realizada'
-- (INSERT já realizada, ou UPDATE onde old.status <> 'realizada'). O brief original
-- rodava a validação inteira sempre que new.status='realizada', mesmo em updates que
-- não mudam o status (ex.: editar checkout_at numa sessão já realizada). Isso causava
-- dois problemas: (1) falso-positivo de "sem sessões restantes" nesses updates, porque
-- sessions_used já contabiliza a própria sessão desde a primeira transição; (2) embora
-- o incremento em si já estivesse guardado contra dupla contagem, rodar a validação
-- redundante é desnecessário e pode bloquear updates legítimos. Envolvendo o bloco
-- inteiro (validação + incremento) na condição de transição resolve os dois pontos.
create function appointments_authorization_guard() returns trigger
language plpgsql as $$
declare
  auth_row authorizations%rowtype;
begin
  if new.status = 'realizada' and new.is_provisional = false
     and (TG_OP = 'INSERT' or old.status <> 'realizada') then
    if new.authorization_id is null then
      raise exception 'sessão realizada exige authorization_id (a menos que is_provisional)';
    end if;
    select * into auth_row from authorizations where id = new.authorization_id for update;
    if auth_row.status <> 'ativa' then
      raise exception 'autorização % não está ativa (status=%)', new.authorization_id, auth_row.status;
    end if;
    if new.starts_at::date < auth_row.valid_from or new.starts_at::date > auth_row.valid_to then
      raise exception 'sessão fora da vigência da autorização %', new.authorization_id;
    end if;
    if auth_row.sessions_used >= auth_row.sessions_authorized then
      raise exception 'autorização % sem sessões restantes', new.authorization_id;
    end if;
    update authorizations set sessions_used = sessions_used + 1 where id = new.authorization_id;
  end if;
  return new;
end;
$$;

create trigger trg_appointments_authorization_guard
  before insert or update on appointments
  for each row execute function appointments_authorization_guard();

create policy appointments_read on appointments for select
  using (
    exists (select 1 from patients pt where pt.id = appointments.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao','faturamento')
      or therapist_id = auth.uid()
      or has_patient_access(patient_id, array['responsavel'])
    )
  );

-- FIX aplicado sobre o brief: a policy original só checava app_current_role(), sem
-- restringir por clínica (mesmo bug já visto nas Tasks 2 e 3). Sem o join até
-- patients.clinic_id, um usuário com role recepcao/supervisor/gestor de QUALQUER
-- clínica poderia inserir appointments para pacientes de outra clínica.
create policy appointments_write_recepcao_supervisor on appointments for insert
  with check (
    app_current_role() in ('recepcao','supervisor','gestor')
    and exists (select 1 from patients pt where pt.id = appointments.patient_id and pt.clinic_id = current_clinic_id())
  );

-- FIX aplicado sobre o brief: mesmo problema — using() original não escopava por
-- clínica, permitindo update cross-clinic para quem tem role recepcao/supervisor/gestor
-- em outra clínica. Adicionado join até patients.clinic_id.
create policy appointments_update on appointments for update
  using (
    exists (select 1 from patients pt where pt.id = appointments.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('recepcao','supervisor','gestor')
      or therapist_id = auth.uid()
    )
  );
