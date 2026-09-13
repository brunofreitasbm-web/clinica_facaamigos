-- supabase/migrations/20260913100000_insurer_badge_color.sql
-- Adiciona a coluna badge_color para armazenar a cor personalizada em formato hex/Tailwind do convênio

alter table insurers add column if not exists badge_color text;

comment on column insurers.badge_color is 'Cor hexadecimal ou chave de cor para exibição da pílula (badge) do convênio ao lado do nome do paciente.';
