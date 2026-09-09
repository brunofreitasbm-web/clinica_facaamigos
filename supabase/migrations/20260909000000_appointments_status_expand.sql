-- Adiciona o novo status 'aguardando_aprovacao_supervisao' na tabela appointments
-- O PostgreSQL exige dropar a constraint antiga e adicionar a nova.

alter table appointments drop constraint appointments_status_check;

alter table appointments add constraint appointments_status_check
  check (status in (
    'agendada',
    'confirmada',
    'realizada',
    'falta_familia',
    'cancelada_familia',
    'cancelada_terapeuta',
    'cancelada_clinica',
    'remarcada',
    'aguardando_aprovacao_supervisao'
  ));
