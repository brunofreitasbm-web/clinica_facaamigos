-- Vincula a sala a uma especialidade — o Alerta de Necessidade de
-- Estagiário passa a contar crianças com check-in por sala (via essa
-- especialidade), em vez da especialidade do terapeuta que atendeu.
alter table rooms add column specialty_id uuid references specialties(id);
