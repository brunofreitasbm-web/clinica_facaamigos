-- supabase/migrations/20260907170002_session_note_media.sql
-- PRD §9.4: "Anexar foto/vídeo curto (opcional; consentimento de imagem
-- verificado)".
--
-- Tabela própria, deliberadamente:
--   * não `documents` — lá a categoria é fixa e o arquivo apareceria na aba
--     Documentos do prontuário, junto de laudo e carteirinha;
--   * não `feed_media` — aquilo é o mural da família, que o responsável vê.
-- Mídia de evolução é dado clínico interno: nenhuma policy para 'responsavel'.
--
-- Chaveada por appointment_id e não por session_note_id porque o anexo é
-- feito ANTES de assinar (a linha de session_notes só nasce na assinatura) e
-- session_notes é append-only — uma correção que gera v2 não deve exigir
-- reanexar o arquivo.
create table session_note_media (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id),
  patient_id uuid not null references patients(id),
  uploaded_by uuid not null references profiles(id),
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

alter table session_note_media enable row level security;

create policy session_note_media_read on session_note_media for select
  using (
    exists (
      select 1 from patients p
      where p.id = session_note_media.patient_id
        and p.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) = any (array['gestor','supervisor'])
      or (select has_patient_access(patient_id, array['terapeuta']))
    )
  );

-- Só o terapeuta dono da sessão anexa, e sempre em nome próprio (PRD §3.3,
-- "tudo tem autor"). Sem UPDATE e sem DELETE para nenhum papel — mesmo
-- append-only de session_notes.
create policy session_note_media_insert on session_note_media for insert
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from appointments a
      join patients p on p.id = a.patient_id
      where a.id = session_note_media.appointment_id
        and a.patient_id = session_note_media.patient_id
        and a.therapist_id = (select auth.uid())
        and p.clinic_id = (select current_clinic_id())
    )
  );

create index idx_session_note_media_appointment on session_note_media (appointment_id);
create index idx_session_note_media_patient on session_note_media (patient_id);
create index idx_session_note_media_uploaded_by on session_note_media (uploaded_by);

-- Mesma trava de trg_feed_media_check_image_consent (20260906000022): se
-- QUALQUER responsável revogou o consentimento de imagem, o banco recusa. A
-- checagem na UI é conveniência; esta é a garantia.
create function trg_session_note_media_check_image_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from guardians g
    where g.patient_id = new.patient_id and g.image_consent = false
  ) then
    raise exception 'A família revogou o consentimento de uso de imagem para este paciente — não é possível anexar fotos/vídeos à evolução.';
  end if;
  return new;
end;
$$;

create trigger session_note_media_image_consent before insert on session_note_media
  for each row execute function trg_session_note_media_check_image_consent();

revoke execute on function trg_session_note_media_check_image_consent()
  from public, anon, authenticated;

-- Bucket privado, 25 MB — mesmo teto de family-feed-media (20260904000022).
-- Sem policies de storage: o acesso é sempre por signed URL gerada no
-- servidor depois de a RLS da tabela autorizar a linha.
insert into storage.buckets (id, name, public, file_size_limit)
values ('session-note-media', 'session-note-media', false, 26214400)
on conflict (id) do nothing;
