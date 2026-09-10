-- Sala de Avaliação: mesma lógica de tag da sala de Treino ABA (is_aba_training),
-- só que sem regra de turma associada — é usada para filtrar/priorizar salas na
-- agenda de avaliação neuropsicológica (fluxo ainda não implementado).
alter table rooms add column is_evaluation_room boolean not null default false;
