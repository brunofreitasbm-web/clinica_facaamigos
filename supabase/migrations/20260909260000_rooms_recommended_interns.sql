-- Estagiários recomendados por sala: sugestão de proporção (padrão 1
-- estagiário por criança), não obrigatório — por isso nullable, sem default
-- forçado além do que a UI sugere.
alter table rooms add column recommended_interns int;
