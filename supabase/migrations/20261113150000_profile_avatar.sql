-- supabase/migrations/20261113150000_profile_avatar.sql
-- Avatar do operador logado (barra do módulo → menu do usuário → "Foto").
-- profiles já tem photo_url (sync do GrupoIB, 20260913030000) — fonte externa,
-- então NÃO reaproveitamos essa coluna: a foto enviada pelo próprio operador
-- fica em storage privado, com o storage_path guardado e signed URL gerada
-- sob demanda pelo client admin (mesmo padrão de patient-photos).
alter table profiles add column if not exists avatar_storage_path text;

-- Bucket privado, sem Storage RLS: acesso só via service-role (upload e
-- signed URL), igual a patient-photos. 5 MB basta para avatar (512px).
insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-avatars', 'profile-avatars', false, 5242880)
on conflict (id) do nothing;
