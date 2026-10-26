-- Corrige o critério de delete_single_message_leads(): a saudação
-- automática do bot ("Olá! Boas-vindas...") conta como mensagem na
-- conversa, então "total de mensagens = 1" nunca batia quando o lead
-- mandou 1 mensagem e só recebeu a saudação automática de volta.
--
-- Critério correto: o CONTATO mandou 1 única mensagem (sender_type
-- 'user') e nenhum atendente humano (sender_type 'agent') respondeu —
-- só bot/sistema. Usa last_message_at da conversa para o prazo de
-- 2 dias (reflete a última atividade, seja do contato ou do bot).

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
       and c.last_message_at is not null
       and c.last_message_at <= now() - interval '2 days'
       and (select count(*) from messages m
             where m.conversation_id = c.id
               and m.sender_type = 'user') = 1
       and not exists (
         select 1 from messages m
          where m.conversation_id = c.id
            and m.sender_type = 'agent'
       )
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
