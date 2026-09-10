-- Reverte profiles.is_intern (20260909270000): estagiário não é mais
-- marcado por profissional específico no cadastro de terapeutas. Vira uma
-- contagem agregada por especialidade — o gestor informa hoje, e no futuro
-- uma integração externa ("sistema de contratados") vai atualizar esse
-- número, relacionado às crianças com check-in por especialidade no
-- indicador de Inteligência (BI).
alter table profiles drop column if exists is_intern;

alter table specialties add column intern_count int not null default 0 check (intern_count >= 0);
