-- registerFirstContact (app/recepcao/pacientes/actions.ts) grava
-- patients.first_contact_at, mas nenhum trigger fechava a etapa
-- 'primeiro_contato' do checklist de entrada — ficava pendente pra sempre.
-- Mesmo padrão das demais colunas em trg_patients_intake_sync
-- (20260906000001_intake_journey.sql).
create or replace function trg_patients_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.first_contact_at is not null and old.first_contact_at is null then
    perform set_intake_step_complete(new.id, 'primeiro_contato');
  end if;
  if new.whatsapp_group_added_at is not null and old.whatsapp_group_added_at is null then
    perform set_intake_step_complete(new.id, 'grupo_whatsapp');
  end if;
  if new.contract_sent_at is not null and old.contract_sent_at is null then
    perform set_intake_step_complete(new.id, 'contrato_enviado');
  end if;
  if new.contract_signed_at is not null and old.contract_signed_at is null then
    perform set_intake_step_complete(new.id, 'contrato_assinado');
  end if;
  if new.payment_confirmed_at is not null and old.payment_confirmed_at is null then
    perform set_intake_step_complete(new.id, 'pagamento_confirmado');
  end if;
  if new.status = 'avaliacao' and old.status is distinct from 'avaliacao' then
    perform set_intake_step_complete(new.id, 'agendamento_anamnese');
  end if;
  if new.evaluated_at is not null and old.evaluated_at is null then
    perform set_intake_step_complete(new.id, 'planejamento_avaliacao');
    perform set_intake_step_complete(new.id, 'avaliacoes_realizadas');
  end if;
  return new;
end;
$$;
