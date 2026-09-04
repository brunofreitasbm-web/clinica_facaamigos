-- supabase/migrations/20260904000022_family_feed.sql
-- Item 4 do PRD "11 incrementos": feed interativo da família. Decisão
-- confirmada com o usuário: mural INDEPENDENTE das evoluções clínicas —
-- terapeuta/recepção posta texto/fotos direto aqui, sem ponte com
-- session_notes (o toggle "compartilhar com a família" do item 6 foi
-- removido do escopo).
create table feed_posts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  author_id uuid not null references profiles(id),
  body text,
  created_at timestamptz not null default now()
);

create table feed_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id),
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

alter table feed_posts enable row level security;
alter table feed_media enable row level security;

-- Leitura: staff da clínica (gestor/supervisor/recepção sempre; terapeuta só
-- do paciente vinculado) ou responsável vinculado ao paciente — mesmo
-- padrão de documents_read (20260904000008_documents.sql).
create policy feed_posts_read on feed_posts for select
  using (
    exists (select 1 from patients p where p.id = feed_posts.patient_id and p.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or has_patient_access(feed_posts.patient_id, array['terapeuta','responsavel'])
    )
  );

-- Escrita: só staff (recepção/supervisor/gestor da clínica, ou terapeuta do
-- paciente) — responsável NÃO tem insert aqui (decisão confirmada: mural é
-- só de leitura pra família; quem escreve nele é a equipe).
create policy feed_posts_insert on feed_posts for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from patients p where p.id = feed_posts.patient_id and p.clinic_id = current_clinic_id())
    and (
      app_current_role() in ('gestor','supervisor','recepcao')
      or has_patient_access(feed_posts.patient_id, array['terapeuta'])
    )
  );

create policy feed_media_read on feed_media for select
  using (
    exists (
      select 1 from feed_posts fp
      join patients p on p.id = fp.patient_id
      where fp.id = feed_media.post_id
        and p.clinic_id = current_clinic_id()
        and (
          app_current_role() in ('gestor','supervisor','recepcao')
          or has_patient_access(fp.patient_id, array['terapeuta','responsavel'])
        )
    )
  );

-- Mídia só pode ser anexada pelo autor do post (o insert do post já passou
-- pela policy acima na mesma transação da server action).
create policy feed_media_insert on feed_media for insert
  with check (
    exists (select 1 from feed_posts fp where fp.id = feed_media.post_id and fp.author_id = auth.uid())
  );

-- Bucket dedicado (privado, sem Storage RLS — acesso só via client
-- service-role gerando signed URL, mesmo padrão de clinic-documents).
insert into storage.buckets (id, name, public, file_size_limit)
values ('family-feed-media', 'family-feed-media', false, 26214400)
on conflict (id) do nothing;
