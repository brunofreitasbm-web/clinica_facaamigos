-- Nem todo tipo de atendimento segue a proporção sugerida de 1 estagiário
-- por criança (ex.: avaliação neuropsicológica, psicoterapia e
-- fonoaudiologia convencionais são 1:1 terapeuta-paciente, sem estagiário
-- de apoio) — flag configurável por tipo em vez de nome de especialidade
-- fixo no código, pra não quebrar se o cadastro for renomeado.
alter table appointment_types add column requires_intern_ratio boolean not null default true;

update appointment_types
set requires_intern_ratio = false
where name in ('Neuropsicologia', 'Psicoterapia', 'Fonoaudiologia');
