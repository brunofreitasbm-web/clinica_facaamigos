-- Robô do portal também na renovação mensal (docs/portal-robot.md).
--
-- Até aqui todo pedido do robô nascia de um contato novo (registration_drafts,
-- etapa 2 de Autorizações). A renovação de quem já é paciente é outra linha em
-- `authorizations` com status 'pendente' e previous_authorization_id (ver
-- app/recepcao/pacientes/pendencias/authorization-renewal-actions.ts). Agora o
-- pedido do robô pode apontar para essa guia pendente.
--
-- patient_id guarda de quem é o pedido, para o formulário do mês seguinte já
-- vir preenchido com o último pedido do paciente (médico, CID, terapias).

alter table portal_robot_jobs alter column draft_id drop not null;
alter table portal_robot_jobs add column authorization_id uuid references authorizations(id) on delete cascade;
alter table portal_robot_jobs add column patient_id uuid references patients(id) on delete set null;
alter table portal_robot_jobs add constraint portal_robot_jobs_one_target
  check (num_nonnulls(draft_id, authorization_id) = 1);

create index portal_robot_jobs_authorization_idx on portal_robot_jobs (authorization_id, requested_at desc)
  where authorization_id is not null;
create index portal_robot_jobs_patient_idx on portal_robot_jobs (patient_id, requested_at desc)
  where patient_id is not null;
-- Um pedido em aberto por guia em renovação (mesma regra dos contatos).
create unique index portal_robot_jobs_one_open_per_authorization on portal_robot_jobs (authorization_id)
  where status in ('na_fila', 'em_andamento', 'aguardando_confirmacao', 'confirmado');

-- Pedidos antigos (contatos já vinculados a um paciente) entram no histórico do paciente.
update portal_robot_jobs j
   set patient_id = d.patient_id
  from registration_drafts d
 where d.id = j.draft_id and j.patient_id is null and d.patient_id is not null;

-- O insert pela tela precisa apontar para um contato OU uma guia da clínica.
drop policy portal_robot_jobs_insert on portal_robot_jobs;
create policy portal_robot_jobs_insert on portal_robot_jobs for insert
  with check (clinic_id = (select current_clinic_id())
              and (select app_current_role()) = any (array['gestor','supervisor','recepcao'])
              and (
                exists (select 1 from registration_drafts d
                         where d.id = draft_id and d.clinic_id = (select current_clinic_id()))
                or exists (select 1 from authorizations a
                             join patient_insurance pi on pi.id = a.patient_insurance_id
                             join patients pt on pt.id = pi.patient_id
                            where a.id = authorization_id and pt.clinic_id = (select current_clinic_id()))
              ));
