-- Terapias que o responsável pediu no bot AGENDAR (specialties.value).
-- Nulo = não informou / "não sei" / pedido anterior à pergunta.
alter table anamnesis_scheduling_requests
  add column if not exists desired_specialties text[];
