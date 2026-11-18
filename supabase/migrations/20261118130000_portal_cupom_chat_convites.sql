-- Portal da Família: primeiro acesso, chat interno só do portal e convite por WhatsApp (18/11/2026).
--
-- 1) guardians.portal_first_login_at: gravado no 1º login por código (verifyFamilyOtp). Quem já tinha
--    profile_id entra com a data da migration (já acessou antes).
-- 2) messages_read: o RESPONSÁVEL passa a ler só o canal do portal, sem mensagens do robô e sem a nota
--    interna que o robô deixa para a supervisão (relatorio_solicitado). O histórico de WhatsApp (Twilio)
--    continua visível para a equipe. A tela da família já filtra; aqui o banco impõe o mesmo.
-- 3) whatsapp_opt_outs: PARAR global (antes só existia parada por fluxo).
-- 4) portal_invite_settings / portal_invites: convite por WhatsApp com intervalo aleatório (lib/portal-invite.ts).
--    A chave nasce DESLIGADA e o cron só age com ela ligada.

-- 1) Primeiro acesso ---------------------------------------------------------------------------------
alter table guardians add column if not exists portal_first_login_at timestamptz;
update guardians set portal_first_login_at = now() where profile_id is not null and portal_first_login_at is null;

-- 2) Chat interno: responsável só enxerga o portal --------------------------------------------------
drop policy messages_read on messages;
create policy messages_read on messages for select
  using (
    (
      exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = (select current_clinic_id()))
      and (
        (select app_current_role()) in ('gestor','supervisor','recepcao')
        or (select has_patient_access(messages.patient_id, array['terapeuta']))
        or (
          (select has_patient_access(messages.patient_id, array['responsavel']))
          and messages.channel = 'portal'
          and messages.sender_type <> 'bot'
          and messages.template_key is distinct from 'relatorio_solicitado'
        )
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

-- 3) Opt-out global de WhatsApp ---------------------------------------------------------------------
create table if not exists whatsapp_opt_outs (
  phone_e164 text primary key,
  source text not null default 'resposta_parar',
  created_at timestamptz not null default now()
);
alter table whatsapp_opt_outs enable row level security; -- sem policy: só service role (webhook e envios em massa)

-- 4) Convite ao Portal --------------------------------------------------------------------------------
create table if not exists portal_invite_settings (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  enabled boolean not null default false,
  daily_cap integer not null default 30 check (daily_cap between 1 and 200),
  min_gap_s integer not null default 120 check (min_gap_s between 30 and 3600),
  max_gap_s integer not null default 420 check (max_gap_s between 30 and 7200),
  next_send_at timestamptz,
  paused_reason text,
  updated_at timestamptz not null default now(),
  check (max_gap_s >= min_gap_s)
);
alter table portal_invite_settings enable row level security;
create policy portal_invite_settings_read on portal_invite_settings for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) = any (array['gestor','supervisor']));
create policy portal_invite_settings_update on portal_invite_settings for update
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) = any (array['gestor','supervisor']))
  with check (clinic_id = (select current_clinic_id()) and (select app_current_role()) = any (array['gestor','supervisor']));

insert into portal_invite_settings (clinic_id) select id from clinics on conflict (clinic_id) do nothing;

create table if not exists portal_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  phone_e164 text not null,
  token text not null unique,
  status text not null check (status in ('enviado','falhou')),
  twilio_sid text,
  error text,
  error_code integer,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);
-- 1 convite por telefone (irmãos compartilham o número) e por responsável.
create unique index if not exists portal_invites_phone_uniq on portal_invites (phone_e164);
create index if not exists portal_invites_sent_idx on portal_invites (clinic_id, sent_at desc);
alter table portal_invites enable row level security;
create policy portal_invites_read on portal_invites for select
  using (clinic_id = (select current_clinic_id()) and (select app_current_role()) = any (array['gestor','supervisor']));

-- Cron de 1 em 1 minuto: cada chamada envia no máximo UMA mensagem e só quando vence next_send_at.
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível — agende /api/twilio/portal-invites/tick manualmente.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'portal_invites_tick';
  perform cron.schedule(
    'portal_invites_tick',
    '* * * * *',
    $cmd$
      select net.http_post(
        url := 'https://sistema.institutofacaamigos.com.br/api/twilio/portal-invites/tick',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
exception when others then
  raise notice 'não foi possível agendar o cron de convites: %', sqlerrm;
end;
$$;
