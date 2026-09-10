-- Colaboradores & Contas: os cadastros vêm do sistema de gestão de pessoas do
-- Grupo IB (public.employees para CLT e public.professionals para PJ), que já
-- guarda o formulário completo — unidade, e-mail e data de nascimento inclusive.
-- `profiles` só recebia nome/conselho/e-mail, então a tela de Colaboradores não
-- conseguia mostrar de qual unidade a pessoa é nem montar a agenda de
-- aniversários. Estas colunas fecham essa lacuna.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists unit_id text references public.units(id);

comment on column public.profiles.birth_date is
  'Data de nascimento, espelhada de employees.birthdate / professionals.birthdate (Grupo IB). Base da funcionalidade de aniversariantes.';
comment on column public.profiles.unit_id is
  'Unidade do Grupo IB à qual o colaborador está lotado (employees.unit_id / professionals.unit_id).';

-- Aniversariantes são consultados por mês/dia, nunca pelo ano — o índice
-- funcional evita varrer a tabela inteira quando a lista crescer.
create index if not exists profiles_birthday_idx
  on public.profiles ((extract(month from birth_date)), (extract(day from birth_date)))
  where birth_date is not null;

-- Backfill 1: e-mail. Até aqui o e-mail dos colaboradores criados pelo próprio
-- app só existia em auth.users; a tela precisa dele sem passar pela admin API.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

-- Backfill 2: unidade e nascimento dos perfis já sincronizados do Grupo IB.
update public.profiles p
set birth_date = coalesce(p.birth_date, e.birthdate),
    unit_id = coalesce(p.unit_id, e.unit_id)
from public.employees e
where p.source_system = 'grupo_ib' and p.source_id = e.id;

update public.profiles p
set birth_date = coalesce(p.birth_date, pr.birthdate),
    unit_id = coalesce(p.unit_id, pr.unit_id)
from public.professionals pr
where p.source_system = 'grupo_ib' and p.source_id = pr.id;

-- Reset de senha e de PIN de assinatura feitos pelo gestor precisam de rastro.
alter table public.audit_log drop constraint audit_log_action_check;

alter table public.audit_log add constraint audit_log_action_check
check (action = ANY (ARRAY[
  'INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'download'::text,
  'draft_validated'::text, 'draft_rejected'::text, 'draft_extracted'::text,
  'intake_batch_uploaded'::text, 'intake_batch_extracted'::text,
  'intake_lead_approved'::text, 'intake_contact_sent'::text,
  'intake_docs_approved'::text, 'intake_docs_rejected'::text,
  'intake_lead_scheduled'::text, 'intake_lead_cancelled'::text,
  'grupoib_sync_access_email_sent'::text, 'grupoib_sync_access_email_failed'::text,
  'grupoib_sync_role_pending_review'::text,
  'staff_password_reset'::text, 'staff_signature_pin_reset'::text
]));
