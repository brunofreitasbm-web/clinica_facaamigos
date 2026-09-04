-- supabase/migrations/20260904000014_final_review_fixes.sql
-- Fix round final (review de branch inteira, pós Task 13): C1-C4, I1-I3, M1, M3, M4.
-- Não edita nenhuma migration já commitada — apenas drop/create policy e
-- create or replace function, seguindo o padrão já usado em 20260904000003b /
-- 20260904000007c / 20260904000006b / 20260904000011b.

-- =====================================================================
-- C1 — profiles_self_update sem WITH CHECK permite escalação de privilégio
-- (role/clinic_id/esdm_certified/active alteráveis pelo próprio usuário).
-- =====================================================================
drop policy profiles_self_update on profiles;

create policy profiles_self_update on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and clinic_id = (select p.clinic_id from profiles p where p.id = auth.uid())
    and esdm_certified = (select p.esdm_certified from profiles p where p.id = auth.uid())
    and active = (select p.active from profiles p where p.id = auth.uid())
  );

-- =====================================================================
-- C2 — appointments_authorization_guard() não é SECURITY DEFINER: para um
-- terapeuta (sem SELECT em authorizations), o SELECT INTO roda vazio e todas
-- as validações são puladas silenciosamente (NULL não é verdadeiro).
-- Fix: SECURITY DEFINER + checagem explícita de "not found".
-- =====================================================================
create or replace function appointments_authorization_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  auth_row authorizations%rowtype;
begin
  if new.status = 'realizada' and new.is_provisional = false
     and (
       TG_OP = 'INSERT'
       or old.status <> 'realizada'
       or old.is_provisional <> new.is_provisional
     ) then
    if new.authorization_id is null then
      raise exception 'sessão realizada exige authorization_id (a menos que is_provisional)';
    end if;
    select * into auth_row from authorizations where id = new.authorization_id for update;
    if not found then
      raise exception 'autorização % não encontrada', new.authorization_id;
    end if;
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

-- =====================================================================
-- C3 — messages_read / messages_write sem isolamento cross-clínica.
-- =====================================================================
drop policy messages_read on messages;
drop policy messages_write on messages;

create policy messages_read on messages for select
  using (
    exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or has_patient_access(patient_id, array['responsavel','terapeuta'])
    )
  );

create policy messages_write on messages for insert
  with check (
    exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('recepcao','supervisor','gestor')
      or has_patient_access(patient_id, array['responsavel'])
    )
  );

-- =====================================================================
-- C4 — billing_items_requires_session_note() não é SECURITY DEFINER: para
-- faturamento (sem SELECT em session_notes), o exists() sempre falha mesmo
-- havendo nota existente.
-- =====================================================================
create or replace function billing_items_requires_session_note() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from appointments a where a.id = new.appointment_id and a.status = 'realizada') then
    raise exception 'billing_items só pode ser criado para appointment realizada';
  end if;
  if not exists (select 1 from session_notes sn where sn.appointment_id = new.appointment_id) then
    raise exception 'billing_items exige session_notes existente para appointment %', new.appointment_id;
  end if;
  return new;
end;
$$;

-- =====================================================================
-- I1 — therapist_contracts_manage_by_gestor / _upd sem escopo de clínica:
-- gestor de qualquer clínica podia gerenciar contrato de profile de outra.
-- =====================================================================
drop policy therapist_contracts_manage_by_gestor on therapist_contracts;
drop policy therapist_contracts_manage_by_gestor_upd on therapist_contracts;

create policy therapist_contracts_manage_by_gestor on therapist_contracts for insert
  with check (
    app_current_role() = 'gestor'
    and exists (select 1 from profiles p where p.id = therapist_contracts.profile_id and p.clinic_id = current_clinic_id())
  );

create policy therapist_contracts_manage_by_gestor_upd on therapist_contracts for update
  using (
    app_current_role() = 'gestor'
    and exists (select 1 from profiles p where p.id = therapist_contracts.profile_id and p.clinic_id = current_clinic_id())
  );

-- =====================================================================
-- I2 — metric_snapshots_write sem escopo: qualquer gestor (de qualquer
-- clínica) podia inserir snapshot com scope_id de outra clínica.
-- =====================================================================
drop policy metric_snapshots_write on metric_snapshots;

create policy metric_snapshots_write on metric_snapshots for insert
  with check (
    app_current_role() = 'gestor' and (
      (scope_type = 'clinica' and scope_id = current_clinic_id())
      or (scope_type = 'profile' and exists (
        select 1 from profiles p where p.id = scope_id and p.clinic_id = current_clinic_id()
      ))
      or (scope_type = 'insurer' and exists (
        select 1 from insurers i where i.id = scope_id and i.clinic_id = current_clinic_id()
      ))
    )
  );

-- =====================================================================
-- I3 — documents sem policy de UPDATE: shared_with_family nunca pode ser
-- alterado (§9.7 inatingível). Recepção/supervisor/gestor da própria
-- clínica podem atualizar.
-- =====================================================================
create policy documents_update on documents for update
  using (
    app_current_role() in ('recepcao','supervisor','gestor')
    and exists (select 1 from patients p where p.id = documents.patient_id and p.clinic_id = current_clinic_id())
  )
  with check (
    app_current_role() in ('recepcao','supervisor','gestor')
    and exists (select 1 from patients p where p.id = documents.patient_id and p.clinic_id = current_clinic_id())
  );

-- =====================================================================
-- M1 — record_access_log_write sem clinic_id: qualquer usuário autenticado
-- podia inserir log de acesso apontando para paciente de outra clínica
-- (accessed_by = auth.uid() sozinho não restringe o patient_id).
-- =====================================================================
drop policy record_access_log_write on record_access_log;

create policy record_access_log_write on record_access_log for insert
  with check (
    accessed_by = auth.uid()
    and exists (select 1 from patients p where p.id = record_access_log.patient_id and p.clinic_id = current_clinic_id())
  );

-- =====================================================================
-- M3 — session_note_pending() sem SECURITY DEFINER: para quem não vê
-- session_notes (recepção/faturamento), a função sempre retorna true.
-- =====================================================================
alter function session_note_pending(uuid) security definer set search_path = public;

-- =====================================================================
-- M4 — billing_periods sem unique(insurer_id, competence_month).
-- =====================================================================
alter table billing_periods
  add constraint billing_periods_insurer_competence_uniq unique (insurer_id, competence_month);
