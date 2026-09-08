-- supabase/migrations/20260908040000_checkin_requests.sql
--
-- Check-in por QR code na entrada da clínica: o paciente/responsável escaneia
-- um cartaz, informa data de nascimento + primeiro nome e recebe uma senha de
-- controle, sem login. A recepção passa a ver "esse paciente já está aqui".
--
-- INVARIANTE CENTRAL: o fluxo anônimo NUNCA escreve em `appointments`. Uma
-- chegada declarada pelo paciente é um sinal de baixa confiança, não um fato
-- clínico — vira uma linha aqui, e só a confirmação humana da recepção chama
-- `checkIn()` (app/recepcao/agenda/session-actions.ts), que é a porta única
-- para `appointments.checkin_at`.
--
-- O motivo é concreto: auto_resolve_appointments (20260906000016) fecha como
-- `status='realizada'` qualquer sessão com `checkin_at` preenchido assim que
-- `ends_at` passa. Se o QR gravasse checkin_at, um paciente que escaneia e vai
-- embora faturaria o convênio (app/faturamento/competencias/actions.ts) e
-- geraria repasse ao terapeuta (app/faturamento/repasses/actions.ts) por uma
-- sessão que não aconteceu. A tabela intermediária existe para impedir isso.

-- Contador da senha diária. Separado da tabela de chegadas de propósito:
-- `max(ticket_number)+1` corre solto sob concorrência (duas famílias
-- escaneando no mesmo segundo recebem a mesma senha) e uma sequence por dia
-- deixaria lixo permanente no catálogo. `on conflict do update ... returning`
-- é uma única instrução atômica que serializa no lock da linha.
create table checkin_ticket_counters (
  clinic_id uuid not null references clinics(id),
  service_date date not null,
  last_number int not null default 0,
  primary key (clinic_id, service_date)
);

-- RLS ligada sem nenhuma policy: mesmo desenho de family_otp_codes
-- (20260906000001) — só o service role e a função security definer abaixo
-- tocam nesta tabela. Nenhum papel do app tem motivo para ler o contador.
alter table checkin_ticket_counters enable row level security;

-- Token do cartaz. Em tabela própria (e não numa env var) para o gestor poder
-- girar o QR sem redeploy caso o link vaze — ver `rotateCheckinToken`.
create table clinic_checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  label text not null default 'Cartaz da entrada',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index clinic_checkin_tokens_active_idx on clinic_checkin_tokens (token) where active;
create index idx_clinic_checkin_tokens_clinic on clinic_checkin_tokens (clinic_id);

alter table clinic_checkin_tokens enable row level security;

create policy clinic_checkin_tokens_read on clinic_checkin_tokens for select
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );

-- Só o gestor gira o cartaz (criar token novo / revogar o atual).
create policy clinic_checkin_tokens_insert on clinic_checkin_tokens for insert
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = 'gestor'
  );

create policy clinic_checkin_tokens_update on clinic_checkin_tokens for update
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) = 'gestor'
  );

-- Chegadas declaradas.
--
-- `clinic_id` é explícito aqui, diferente de `appointments` (que deriva o
-- escopo de patients.clinic_id): a linha de "visitante" não tem patient_id nem
-- appointment_id, então não haveria por onde derivar a clínica — e sem isso
-- nem a RLS nem a numeração da senha funcionariam.
create table checkin_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),

  -- Data civil da clínica (America/Sao_Paulo), calculada na aplicação com
  -- todayInTimeZone(CLINIC_TIMEZONE). Nunca o relógio do celular (que o
  -- usuário controla) e nunca current_date (que é UTC no servidor — depois
  -- das 21h em São Paulo já seria o dia seguinte).
  service_date date not null,

  -- ticket_number ordena e garante unicidade; ticket_label é o que se fala em
  -- voz alta. Ambos preenchidos pelo trigger assign_checkin_ticket abaixo —
  -- o default 0 é o sinal de "ainda não numerado" que dispara o trigger.
  ticket_number int not null default 0,
  ticket_label text not null default '',

  -- Devolvido uma única vez ao navegador em cookie httpOnly, para a tela
  -- pública poder consultar o próprio status ("já me chamaram?") sem que o
  -- `id` sequencialmente adivinhável exponha as chegadas dos outros.
  public_token text not null default encode(gen_random_bytes(16), 'hex'),

  kind text not null check (kind in ('agendado','sem_agendamento')),
  patient_id uuid references patients(id),
  appointment_id uuid references appointments(id),

  -- Quando a busca acha mais de um paciente com a mesma data de nascimento
  -- (gêmeos/irmãos) ou mais de uma sessão elegível do mesmo paciente (duas
  -- sessões no dia), NÃO escolhemos: guardamos os candidatos e a recepção
  -- decide no clique. Chutar aqui significaria fazer check-in do irmão errado.
  candidate_appointment_ids uuid[] not null default '{}',

  -- Grau de confiança do casamento, para a recepção saber o que conferir.
  -- Nunca é exposto na tela pública.
  match_quality text not null default 'exato'
    check (match_quality in ('exato','ambiguo','nome_divergente','fora_da_janela','nenhum')),

  -- O que a família digitou, como digitou: sem isso uma chegada não
  -- encontrada é irreconciliável. Expurgado em 90 dias (purge_checkin_request_pii).
  declared_first_name text not null,
  declared_birth_date date not null,

  status text not null default 'aguardando'
    check (status in ('aguardando','confirmado','descartado','expirado')),

  source text not null default 'qr' check (source in ('qr','tablet','recepcao')),

  -- sha256(ip || salt) — nunca o IP em claro (minimização, LGPD). Serve ao
  -- throttle durável e à forense de abuso.
  ip_hash text,

  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  resolution_note text,

  -- Toda linha resolvida carrega quando foi resolvida.
  constraint checkin_requests_resolvido_tem_carimbo
    check (status = 'aguardando' or resolved_at is not null)
);

-- Senha única por clínica/dia. Backstop do contador: se algum caminho novo
-- tentar numerar por fora, o insert falha em vez de duplicar a senha.
create unique index checkin_requests_ticket_uk
  on checkin_requests (clinic_id, service_date, ticket_number);

create unique index checkin_requests_public_token_uk on checkin_requests (public_token);

-- Mãe e pai escaneando, ou toque duplo no botão, não geram duas senhas para a
-- MESMA sessão. A rota captura o 23505 e devolve a senha que já existe, que é
-- o comportamento correto na vida real (a segunda pessoa vê a mesma senha).
create unique index checkin_requests_open_appointment_uk
  on checkin_requests (appointment_id)
  where status = 'aguardando' and appointment_id is not null;

-- Consulta quente do painel da recepção e do guard de auto_resolve_appointments.
create index checkin_requests_open_idx
  on checkin_requests (clinic_id, service_date, created_at)
  where status = 'aguardando';

create index checkin_requests_ip_idx on checkin_requests (ip_hash, created_at desc);
create index idx_checkin_requests_appointment on checkin_requests (appointment_id);
create index idx_checkin_requests_patient on checkin_requests (patient_id);
create index idx_checkin_requests_resolved_by on checkin_requests (resolved_by);

-- Numeração da senha, na mesma transação do insert: se o insert falhar por
-- qualquer constraint, o número não é consumido (não abre buraco na sequência).
create function assign_checkin_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_number int;
begin
  insert into checkin_ticket_counters (clinic_id, service_date, last_number)
  values (new.clinic_id, new.service_date, 1)
  on conflict (clinic_id, service_date)
    do update set last_number = checkin_ticket_counters.last_number + 1
  returning last_number into v_number;

  new.ticket_number := v_number;
  -- Prefixo que gira por dia do ano: a senha "P012" de ontem, num papelzinho
  -- esquecido no bolso, não se confunde com a "Q012" de hoje.
  new.ticket_label := chr(65 + (extract(doy from new.service_date)::int % 26))
                      || lpad(v_number::text, 3, '0');
  return new;
end;
$$;

create trigger trg_checkin_requests_assign_ticket
  before insert on checkin_requests
  for each row when (new.ticket_number = 0)
  execute function assign_checkin_ticket();

alter table checkin_requests enable row level security;

create policy checkin_requests_read on checkin_requests for select
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );

create policy checkin_requests_update on checkin_requests for update
  using (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
  );

-- Insert autenticado existe só para a recepção lançar uma chegada manualmente
-- pelo painel (quem chegou sem celular, ver F11 do plano) — daí o
-- `source = 'recepcao'` no with check. O caminho anônimo do QR NÃO passa por
-- aqui: passa por service role no route handler, como family_otp_codes e
-- registration_drafts, porque o projeto não concede execute/grant a `anon`
-- em lugar nenhum (ver 20260907170005 e 20260908030000).
create policy checkin_requests_insert on checkin_requests for insert
  with check (
    clinic_id = (select current_clinic_id())
    and (select app_current_role()) in ('gestor','supervisor','recepcao')
    and source = 'recepcao'
  );

revoke all on checkin_requests from anon;
revoke all on clinic_checkin_tokens from anon;
revoke all on checkin_ticket_counters from anon, authenticated;
revoke execute on function assign_checkin_ticket() from public, anon, authenticated;

-- Realtime para o painel de chegadas da recepção — mesmo padrão (e mesmo
-- bloco defensivo) de 20260904000020_attendance_presence.sql. `replica
-- identity full` para o payload de UPDATE trazer o valor anterior de `status`.
alter table checkin_requests replica identity full;

do $$
begin
  alter publication supabase_realtime add table checkin_requests;
exception when others then
  raise notice 'supabase_realtime indisponível ou checkin_requests já publicada: %', sqlerrm;
end;
$$;

-- Auditoria só nas resoluções (quem confirmou/descartou o quê). O insert
-- anônimo não tem actor_id útil — auth.uid() seria null —, então auditar
-- INSERT aqui só geraria ruído.
create trigger trg_checkin_requests_audit
  after update on checkin_requests
  for each row execute function fn_audit_log();

-- Minimização de dados (LGPD): nome e data de nascimento digitados por uma
-- pessoa não autenticada não têm por que sobreviver ao dia a que se referem.
-- 90 dias cobre qualquer conferência retroativa de faturamento.
create function purge_checkin_request_pii() returns void
language sql security definer set search_path = public as $$
  update checkin_requests
  set declared_first_name = '—',
      declared_birth_date = date '1900-01-01',
      ip_hash = null
  where created_at < now() - interval '90 days'
    and declared_first_name <> '—';
$$;

revoke execute on function purge_checkin_request_pii() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'purge_checkin_request_pii_daily',
    '17 3 * * *',
    $job$select purge_checkin_request_pii();$job$
  );
exception when others then
  raise notice 'pg_cron indisponível neste ambiente — agende purge_checkin_request_pii() externamente. %', sqlerrm;
end;
$$;

-- Token inicial do cartaz da clínica de desenvolvimento (DEV_CLINIC_ID em
-- lib/constants.ts). Idempotente: rodar a migration de novo não cria um
-- segundo cartaz ativo.
insert into clinic_checkin_tokens (clinic_id, label)
select 'c0000000-0000-0000-0000-000000000001', 'Cartaz da entrada'
where exists (select 1 from clinics where id = 'c0000000-0000-0000-0000-000000000001')
  and not exists (
    select 1 from clinic_checkin_tokens
    where clinic_id = 'c0000000-0000-0000-0000-000000000001' and active
  );
