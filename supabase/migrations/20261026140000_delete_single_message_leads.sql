-- Exclusão automática de leads de mensagem única (decidido com a recepção em
-- 2026-10-26): quem mandou só UMA mensagem (ex.: "Olá", "Oi") e nunca mais
-- voltou, 2+ dias depois, é apagado de vez — não é "sem_retorno" (que fica
-- em conversation_attendances para histórico), é lixo de conversa que nunca
-- começou.
--
-- Critério: twilio_conversations.kind = 'lead', exatamente 1 linha em
-- `messages` para essa conversa, essa mensagem é do contato
-- (last_message_sender = 'contact', nunca houve resposta da clínica/bot) e
-- last_message_at <= now() - 2 dias.
--
-- Trava: não apaga se houver rascunho de cadastro 'extracted' pendente para
-- o telefone (mesma trava de close_inactive_conversations).
--
-- Ordem de exclusão: messages -> zera conversation_id em insurance_intake_leads
-- (FK sem cascade) -> twilio_conversations (conversation_attendances cai em
-- cascade, ver 20260920000000_conversation_attendances.sql:86).

create or replace function delete_single_message_leads() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with candidates as (
    select c.id
      from twilio_conversations c
     where c.kind = 'lead'
       and c.status = 'open'
       and c.last_message_sender = 'contact'
       and c.last_message_at is not null
       and c.last_message_at <= now() - interval '2 days'
       and (select count(*) from messages m where m.conversation_id = c.id) = 1
       and not exists (
         select 1 from registration_drafts d
          where d.status = 'extracted'
            and d.source_phone is not null
            and normalize_br_phone_key(d.source_phone) = normalize_br_phone_key(c.phone_number)
       )
  ),
  unlink_insurance_leads as (
    update insurance_intake_leads l
       set conversation_id = null
      from candidates k
     where l.conversation_id = k.id
    returning l.id
  ),
  deleted_messages as (
    delete from messages m
     using candidates k
     where m.conversation_id = k.id
    returning m.id
  ),
  deleted_conversations as (
    delete from twilio_conversations c
     using candidates k
     where c.id = k.id
    returning c.id
  )
  select count(*) into v_count from deleted_conversations;

  return v_count;
end;
$$;

revoke execute on function delete_single_message_leads() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'delete_single_message_leads_hourly',
    '15 * * * *',
    $job$select delete_single_message_leads();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende delete_single_message_leads() externamente. %', sqlerrm;
end;
$$;
