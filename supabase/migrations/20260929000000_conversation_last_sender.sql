-- supabase/migrations/20260929000000_conversation_last_sender.sql
--
-- Sinalizador "quem mandou a última mensagem" na fila de Atendimento
-- (app/recepcao/atendimento e /m/atendimento).
--
-- 1. `messages.sender_type` tinha default 'user' e vários inserts outbound
--    (aviso de faltas, troca de horário, alertas gerados em SQL, respostas
--    da supervisão) não informavam o campo — a mensagem que a CLÍNICA
--    mandou ficava gravada como se fosse do contato. Passa a existir
--    'system' (automação) e um trigger BEFORE INSERT corrige outbound
--    gravado como 'user': com template_key é automação, sem é resposta
--    humana. Backfill com a mesma regra.
--
-- 2. `twilio_conversations.last_message_sender`: quem falou por último na
--    conversa ('contact' | 'agent' | 'bot' | 'automation'), mantido por
--    trigger AFTER INSERT em `messages`. Antes, `last_message_at` e o
--    preview eram gravados à mão em vários pontos do código, de forma
--    inconsistente (a resposta do bot no webhook nem mexia em
--    last_message_at), então não dava pra derivar isso no front.
--    Envio com delivery_status 'failed' não conta: o contato não recebeu.
--    Só canal WhatsApp conta: a fila é de WhatsApp, e o FAQ bot grava um
--    aviso interno de canal 'portal' na mesma conversa.

-- 1) sender_type 'system' + normalização de outbound gravado como 'user'
alter table messages drop constraint if exists messages_sender_type_check;
alter table messages add constraint messages_sender_type_check
  check (sender_type in ('user','bot','agent','system'));

comment on column messages.sender_type is 'Quem produziu a mensagem: user (contato/família), agent (humano da clínica), bot (chatbot), system (automação: lembretes, avisos, alertas).';

create or replace function fn_messages_normalize_sender_type() returns trigger
language plpgsql as $$
begin
  if new.direction = 'outbound' and new.sender_type = 'user' then
    new.sender_type := case when new.template_key is not null then 'system' else 'agent' end;
  end if;
  return new;
end;
$$;

-- Nome começa com "a" para rodar antes dos demais BEFORE triggers (ordem alfabética).
drop trigger if exists a_trg_messages_normalize_sender_type on messages;
create trigger a_trg_messages_normalize_sender_type before insert on messages
  for each row execute function fn_messages_normalize_sender_type();

update messages
   set sender_type = case when template_key is not null then 'system' else 'agent' end
 where direction = 'outbound' and sender_type = 'user';

-- 2) Último remetente da conversa
alter table twilio_conversations add column if not exists last_message_sender text
  check (last_message_sender in ('contact','agent','bot','automation'));

comment on column twilio_conversations.last_message_sender is 'Quem mandou a última mensagem de WhatsApp entregue na conversa: contact, agent, bot ou automation. Mantido pelo trigger trg_conversation_last_sender em messages.';

create or replace function fn_conversation_last_sender() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ts timestamptz := coalesce(new.sent_at, now());
  v_sender text;
begin
  if new.conversation_id is null
     or new.channel <> 'whatsapp'
     or coalesce(new.delivery_status, '') = 'failed' then
    return new;
  end if;

  v_sender := case
    when new.direction = 'inbound' then 'contact'
    when new.sender_type = 'agent' then 'agent'
    when new.sender_type = 'bot' then 'bot'
    else 'automation'
  end;

  update twilio_conversations
     set last_message_sender = v_sender,
         last_message_at = greatest(coalesce(last_message_at, v_ts), v_ts)
   where id = new.conversation_id
     and (last_message_at is null or last_message_at <= v_ts or last_message_sender is null);

  return new;
exception when others then
  raise warning '% falhou: %', TG_NAME, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_conversation_last_sender on messages;
create trigger trg_conversation_last_sender after insert on messages
  for each row execute function fn_conversation_last_sender();

revoke execute on function fn_conversation_last_sender() from public, anon, authenticated;

-- Backfill: última mensagem de WhatsApp não-falha de cada conversa.
update twilio_conversations c
   set last_message_sender = m.sender
  from (
    select distinct on (conversation_id)
           conversation_id,
           case
             when direction = 'inbound' then 'contact'
             when sender_type = 'agent' then 'agent'
             when sender_type = 'bot' then 'bot'
             else 'automation'
           end as sender
      from messages
     where conversation_id is not null
       and channel = 'whatsapp'
       and coalesce(delivery_status, '') <> 'failed'
     order by conversation_id, sent_at desc nulls last
  ) m
 where c.id = m.conversation_id;
