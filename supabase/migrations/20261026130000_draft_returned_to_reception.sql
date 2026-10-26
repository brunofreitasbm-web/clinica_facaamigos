-- A Supervisão pode devolver à fila de pendências da Recepção um contato que
-- já tinha sido habilitado para a Agenda 1ª Avaliação (ex.: marcado como
-- "Particular / sem guia" por engano). O motivo é interno — só a equipe vê,
-- a família não tem acesso a registration_drafts do tipo whatsapp/avulso e o
-- texto nunca é enviado por WhatsApp.

alter table registration_drafts
  add column returned_to_reception_at timestamptz,
  add column returned_to_reception_by uuid references profiles(id),
  add column returned_to_reception_reason text;

comment on column registration_drafts.returned_to_reception_reason is
  'Motivo (texto interno) da devolução pela Supervisão à fila da Recepção. Limpo quando a Recepção habilita o agendamento de novo.';
