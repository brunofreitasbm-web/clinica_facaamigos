-- Marca um profissional como estagiário — usado pelo indicador de
-- Inteligência (BI) que compara nº de crianças com nº de estagiários
-- presentes por sala/turno (regra sugerida: 1 estagiário por criança).
alter table profiles add column is_intern boolean not null default false;
