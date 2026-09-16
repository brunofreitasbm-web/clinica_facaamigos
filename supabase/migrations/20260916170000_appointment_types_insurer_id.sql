-- Migration: Vincular tipos de atendimento a planos de saúde (insurers) e códigos de procedimento
alter table appointment_types
  add column if not exists insurer_id uuid references insurers(id) on delete set null,
  add column if not exists procedure_code text;

create index if not exists idx_appointment_types_insurer_id on appointment_types(insurer_id);
