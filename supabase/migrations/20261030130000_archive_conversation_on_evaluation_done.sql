-- Arquiva (aba "Encerradas") a conversa do WhatsApp assim que a 1ª avaliação
-- do paciente é concluída (appointments.status -> 'realizada', is_evaluation).
--
-- Decidido com a recepção em 2026-10-29: imediato, sem as travas do job de 24h
-- (close_inactive_conversations: mensagem não lida / última msg do contato).
-- A avaliação feita encerra o funil de captação; o que a família escrever
-- depois reabre a conversa sozinha (lib/twilio.ts: status 'closed' -> 'open').
--
-- Espelha setConversationClosed (app/recepcao/atendimento/actions.ts): devolve
-- a conversa ao bot, libera o responsável e fecha o atendimento aberto como
-- 'agendado' (mesmo desfecho do job de 24h para avaliação realizada).
--
-- Roda como trigger: vale para qualquer tela/rotina que marque a avaliação
-- como realizada, e não depende de pg_cron.

create or replace function fn_archive_conversation_on_evaluation_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_evaluation
     or new.status is distinct from 'realizada'
     or old.status is not distinct from 'realizada' then
    return new;
  end if;

  with closed as (
    update twilio_conversations c
       set status = 'closed',
           unread_count = 0,
           assigned_to = null,
           is_bot_active = true,
           escalation_reason = null
     where c.status <> 'closed'
       and (
         c.patient_id = new.patient_id
         or normalize_br_phone_key(c.phone_number) in (
           select normalize_br_phone_key(g.phone) from guardians g
            where g.patient_id = new.patient_id and g.phone is not null
         )
       )
    returning c.id
  )
  update conversation_attendances a
     set closed_at = now(),
         outcome = 'agendado',
         closed_by_kind = 'system',
         appointment_id = coalesce(a.appointment_id, new.id)
    from closed x
   where a.conversation_id = x.id
     and a.closed_at is null;

  return new;
exception when others then
  -- Arquivar é conveniência: nunca pode impedir o registro da avaliação.
  raise warning '% falhou: %', TG_NAME, sqlerrm;
  return new;
end;
$$;

revoke execute on function fn_archive_conversation_on_evaluation_done() from public, anon, authenticated;

drop trigger if exists trg_archive_conversation_on_evaluation_done on appointments;
create trigger trg_archive_conversation_on_evaluation_done
  after update of status on appointments
  for each row execute function fn_archive_conversation_on_evaluation_done();
