-- external_contacts/external_contact_logs (Onda 3, Rede Externa): recepção
-- também precisa ler pra coordenar logística de contato com escola/médicos
-- a partir do prontuário do paciente (mesmo padrão de messages_read/
-- quick_responses_read, que já incluem recepcao ao lado de gestor/supervisor).

drop policy if exists external_contacts_read on external_contacts;
create policy external_contacts_read on external_contacts
  for select using (
    clinic_id = current_clinic_id()
    and (app_current_role() in ('gestor', 'supervisor', 'recepcao') or has_patient_access(patient_id, array['terapeuta']))
  );

drop policy if exists external_contact_logs_read on external_contact_logs;
create policy external_contact_logs_read on external_contact_logs
  for select using (
    external_contact_id in (
      select id from external_contacts ec
      where ec.clinic_id = current_clinic_id()
        and (app_current_role() in ('gestor', 'supervisor', 'recepcao') or has_patient_access(ec.patient_id, array['terapeuta']))
    )
  );

-- Recepção também registra ligações/contatos feitos com escola/médico (log de interação), mesmo sem poder criar/editar o cadastro do contato em si.
drop policy if exists external_contact_logs_write on external_contact_logs;
create policy external_contact_logs_write on external_contact_logs
  for insert with check (
    contacted_by = auth.uid()
    and external_contact_id in (
      select id from external_contacts ec
      where ec.clinic_id = current_clinic_id()
        and (app_current_role() in ('gestor', 'supervisor', 'recepcao') or has_patient_access(ec.patient_id, array['terapeuta']))
    )
  );
