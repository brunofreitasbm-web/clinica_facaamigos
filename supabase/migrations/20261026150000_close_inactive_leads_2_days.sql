-- Ajusta close_inactive_conversations() (20261026120000_close_inactive_conversations.sql):
-- prazo de lead sem retorno revisto de 7 para 2 dias (recepção, 2026-10-26).
-- Mesma função, só muda o intervalo da regra de lead; demais travas e
-- regras (paciente, avaliação feita) continuam iguais.

create or replace function close_inactive_conversations() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with candidates as (
    select c.id,
           case
             when eval_done.at is not null
                  and eval_done.at <= now() - interval '24 hours'
                  and c.last_message_at <= now() - interval '24 hours' then 'agendado'
             when c.kind = 'patient'
                  and c.last_message_at <= now() - interval '2 days' then 'resolvido'
             when c.kind = 'lead'
                  and c.last_message_at <= now() - interval '2 days' then 'sem_retorno'
           end as outcome
      from twilio_conversations c
      left join lateral (
        select max(a.starts_at) as at
          from appointments a
         where a.is_evaluation
           and a.status = 'realizada'
           and (
             a.patient_id = c.patient_id
             or a.patient_id in (
               select g.patient_id from guardians g
                where g.phone is not null
                  and normalize_br_phone_key(g.phone) = normalize_br_phone_key(c.phone_number)
             )
           )
      ) eval_done on true
     where c.status = 'open'
       and c.unread_count = 0
       and c.last_message_at is not null
       and c.last_message_sender is distinct from 'contact'
       and not exists (
         select 1 from appointments a
          where a.is_evaluation
            and a.status in ('agendada', 'confirmada')
            and a.starts_at > now()
            and (
              a.patient_id = c.patient_id
              or a.patient_id in (
                select g.patient_id from guardians g
                 where g.phone is not null
                   and normalize_br_phone_key(g.phone) = normalize_br_phone_key(c.phone_number)
              )
            )
       )
       and not exists (
         select 1 from registration_drafts d
          where d.status = 'extracted'
            and d.source_phone is not null
            and normalize_br_phone_key(d.source_phone) = normalize_br_phone_key(c.phone_number)
       )
  ),
  closed as (
    update twilio_conversations c
       set status = 'closed',
           unread_count = 0,
           assigned_to = null,
           is_bot_active = true,
           escalation_reason = null
      from candidates k
     where c.id = k.id
       and k.outcome is not null
    returning c.id, k.outcome
  ),
  attendances as (
    update conversation_attendances a
       set closed_at = now(),
           outcome = x.outcome,
           closed_by_kind = 'system'
      from closed x
     where a.conversation_id = x.id
       and a.closed_at is null
    returning a.id
  )
  select count(*) into v_count from closed;

  return v_count;
end;
$$;
