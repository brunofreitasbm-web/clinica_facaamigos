-- Liga appointments ao catálogo de appointment_types (app/gestor/atendimentos),
-- até aqui completamente desconectado do fluxo de agendamento da recepção:
-- a duração da sessão era um valor fixo (50min) hardcoded em createAppointment
-- e a lista de "disciplinas" era um array estático no front, sem relação com
-- os tipos cadastrados pelo gestor.
alter table appointments
  add column appointment_type_id uuid references appointment_types(id);

create index if not exists appointments_appointment_type_id_idx
  on appointments(appointment_type_id);
