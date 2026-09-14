-- supabase/migrations/20260913260000_patient_photo_wall.sql
-- "Mural da Família": a família envia uma foto da criança pelo portal
-- (app/familia) pra compor o mural físico da recepção e ajudar a equipe a
-- reconhecer a criança presencialmente. patients não tinha nenhum campo de
-- foto (só profiles.photo_url, que é de outra fonte — sync do GrupoIB,
-- 20260913030000). Guardamos o storage_path (não uma URL pronta) porque o
-- bucket é privado — mesmo padrão de documents/feed_media: quem lê gera um
-- signed URL sob demanda com o client admin.
alter table patients add column photo_storage_path text;
alter table patients add column photo_updated_at timestamptz;

-- Bucket dedicado (privado, sem Storage RLS — acesso só via client
-- service-role gerando signed URL, mesmo padrão de clinic-documents e
-- family-feed-media).
insert into storage.buckets (id, name, public, file_size_limit)
values ('patient-photos', 'patient-photos', false, 10485760)
on conflict (id) do nothing;

-- Grava o upload feito pela família. Função security definer (não uma
-- policy de UPDATE direta em patients) porque RLS comum não restringe QUAIS
-- colunas um UPDATE altera — um responsável com policy de update em
-- `patients` poderia reescrever qualquer campo do cadastro, não só a foto.
-- Mesmo padrão de set_family_image_consent (20260906000022_family_lgpd_
-- consent.sql) e accept_family_lgpd_consent.
create function set_patient_photo(p_patient_id uuid, p_storage_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_patient_access(p_patient_id, array['responsavel']) then
    raise exception 'sem acesso a este paciente';
  end if;

  update patients
  set photo_storage_path = p_storage_path, photo_updated_at = now()
  where id = p_patient_id;
end;
$$;

revoke all on function set_patient_photo(uuid, text) from public;
grant execute on function set_patient_photo(uuid, text) to authenticated;
