-- supabase/migrations/20260909100000_twilio_lead_conversations.sql
-- Conversas de LEAD (número ainda sem cadastro) na Central de Atendimento.
--
-- Até aqui `twilio_conversations.patient_id` e `messages.patient_id` eram NOT
-- NULL, então o webhook (lib/twilio.ts) só persistia a conversa quando o
-- telefone casava com `guardians.phone`. Quem pergunta "vocês atendem planos?"
-- é justamente quem ainda não é paciente — essas conversas sumiam, e a
-- recepção nunca via quem procurou a clínica.
--
-- O bloqueio real NÃO era o NOT NULL, e sim a RLS: as 6 policies das duas
-- tabelas fazem `exists (select 1 from patients pt where pt.id = X.patient_id
-- and pt.clinic_id = current_clinic_id())`. Com patient_id nulo o EXISTS é
-- falso e a linha some para todo mundo. Por isso `twilio_conversations` ganha
-- `clinic_id` próprio como âncora de tenancy, e `messages` de lead chega ao
-- clinic_id por `conversation_id` (índice messages_conversation_id_idx já
-- existe).

alter table twilio_conversations
  add column clinic_id uuid references clinics(id),
  add column contact_name text,
  add column kind text not null default 'patient' check (kind in ('patient','lead')),
  add column escalation_reason text;

update twilio_conversations tc
   set clinic_id = p.clinic_id
  from patients p
 where p.id = tc.patient_id;

alter table twilio_conversations alter column clinic_id set not null;
alter table twilio_conversations alter column patient_id drop not null;

create index twilio_conversations_clinic_idx
  on twilio_conversations (clinic_id, last_message_at desc);

-- 'pending' = bot escalou e está esperando um humano assumir (ver
-- lib/twilio-faq-bot.ts). O toggle da recepção devolve para 'open'.
alter table twilio_conversations drop constraint twilio_conversations_status_check;
alter table twilio_conversations add constraint twilio_conversations_status_check
  check (status in ('open','pending','closed'));

alter table messages alter column patient_id drop not null;

-- Intenção classificada pelo agente FAQ na resposta (outbound). Alimenta os
-- botões de resposta sugerida da Central e o relatório de "o que mais
-- perguntam". Inbound fica nulo.
alter table messages add column intent text;

-- Uma mensagem é de paciente OU de uma conversa (lead). Nunca solta.
alter table messages add constraint messages_owner_check
  check (patient_id is not null or conversation_id is not null);

-- =====================================================================
-- RLS — cada policy ganha o ramo do lead: sem paciente, o isolamento de
-- clínica vem de twilio_conversations.clinic_id. `responsavel` e `terapeuta`
-- ficam de fora do ramo de lead de propósito: lead não tem portal nem vínculo
-- terapêutico.
-- =====================================================================
drop policy twilio_conversations_read on twilio_conversations;
drop policy twilio_conversations_write on twilio_conversations;
drop policy twilio_conversations_update on twilio_conversations;

create policy twilio_conversations_read on twilio_conversations for select
  using (
    clinic_id = current_clinic_id()
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy twilio_conversations_write on twilio_conversations for insert
  with check (
    clinic_id = current_clinic_id()
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy twilio_conversations_update on twilio_conversations for update
  using (
    clinic_id = current_clinic_id()
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

drop policy messages_read on messages;
drop policy messages_write on messages;
drop policy messages_update_staff on messages;

create policy messages_read on messages for select
  using (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (
        (select app_current_role()) in ('gestor','supervisor','recepcao')
        or (select has_patient_access(messages.patient_id, array['responsavel','terapeuta']))
      )
    )
    or (
      messages.patient_id is null
      and (select app_current_role()) in ('gestor','supervisor','recepcao')
      and exists (
        select 1 from twilio_conversations c
         where c.id = messages.conversation_id
           and c.clinic_id = (select current_clinic_id())
      )
    )
  );

create policy messages_write on messages for insert
  with check (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (
        (select app_current_role()) in ('recepcao','supervisor','gestor')
        or (select has_patient_access(messages.patient_id, array['responsavel']))
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

create policy messages_update_staff on messages for update
  using (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (select app_current_role()) in ('recepcao','supervisor','gestor')
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
  )
  with check (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (select app_current_role()) in ('recepcao','supervisor','gestor')
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

-- =====================================================================
-- insurers.active — a lista de convênios agora vai para o WhatsApp na voz da
-- clínica (lib/twilio-faq-bot.ts), então linhas de teste não podem vazar.
-- Filtrar por `name ilike '%teste%'` na consulta seria frágil.
-- =====================================================================
alter table insurers add column active boolean not null default true;
update insurers set active = false where name ilike '%teste%';
