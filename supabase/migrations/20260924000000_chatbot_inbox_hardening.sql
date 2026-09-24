-- supabase/migrations/20260924000000_chatbot_inbox_hardening.sql
--
-- Correções de segurança e confiabilidade do pipeline de chatbot/inbox
-- (Twilio WhatsApp), encontradas em auditoria do código de
-- app/recepcao/atendimento e lib/twilio.ts:
--
-- 1. `messages_write` deixava um `responsavel` inserir com QUALQUER
--    `sender_type`/`channel` — bastava ter acesso ao paciente. Isso permite
--    a um responsável forjar uma resposta de agente/bot (sender_type='agent'
--    ou 'bot') e falsear os timestamps de `conversation_attendances`
--    (primeira resposta, escalonamento). A regra correta: responsável só
--    pode inserir mensagens de portal, como usuário.
--
-- 2. Sem índice em `twilio_sid`, cada callback de status da Twilio fazia
--    full scan em `messages`; e sem índice composto em
--    `(conversation_id, sent_at)`, toda leitura do histórico da conversa
--    (ordenada por sent_at) também.
--
-- 3. `messages` não tinha coluna para o `ErrorCode` da Twilio — o webhook de
--    status só fazia `console.log` dele e descartava.

-- 1) RLS: restringir o insert de `responsavel` a mensagens de portal, como
-- usuário, e apenas nas próprias conversas (via has_patient_access).
drop policy if exists messages_write on messages;

create policy messages_write on messages for insert
  with check (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (
        (select app_current_role()) in ('recepcao','supervisor','gestor')
        or (
          (select has_patient_access(messages.patient_id, array['responsavel']))
          and messages.channel = 'portal'
          and messages.sender_type = 'user'
        )
      )
    )
    or (
      messages.patient_id is null
      and (select app_current_role()) in ('recepcao','supervisor','gestor')
      and exists (
        select 1 from twilio_conversations c
         where c.id = messages.conversation_id
           and c.clinic_id = (select current_clinic_id())
      )
    )
  );

-- 2) Índices para os caminhos de leitura mais frequentes do inbox.
create unique index if not exists idx_messages_twilio_sid on messages (twilio_sid) where twilio_sid is not null;
create index if not exists idx_messages_conversation_sent_at on messages (conversation_id, sent_at desc);

-- 3) Código de erro da Twilio (ex.: 63016 — fora da janela de 24h),
-- persistido pelo webhook de status para diagnóstico e métricas.
alter table messages add column if not exists error_code text;

comment on column messages.error_code is 'ErrorCode retornado pelo callback de status da Twilio (ex.: 63016 = fora da janela de 24h do WhatsApp).';
comment on index idx_messages_twilio_sid is 'Único parcial: usado tanto para acelerar o lookup do callback de status quanto para deduplicar reentregas do webhook de mensagens (mesmo MessageSid).';

-- 4) Incremento atômico de unread_count — o código lia unread_count e
-- escrevia de volta em dois passos (`update ... = conversation.unread_count
-- + 1`), o que perde incrementos sob concorrência (duas mensagens quase
-- simultâneas do mesmo contato liam o mesmo valor e uma pisava na outra).
create or replace function increment_conversation_unread(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update twilio_conversations
     set unread_count = coalesce(unread_count, 0) + 1
   where id = p_conversation_id;
$$;

comment on function increment_conversation_unread(uuid) is 'Incremento atômico de twilio_conversations.unread_count (evita perder incrementos sob concorrência).';
