-- Onda 3, módulo Régua de Comunicação e Templates. A tela
-- /gestor/configuracoes/notificacoes foi esvaziada antes porque não havia
-- schema pra modelos de notificação — só um formulário local com "salvar"
-- simulado. Esta migration cria essa tabela. O disparo automático continua
-- vivendo nos crons já existentes (app/api/twilio/*), que hoje têm a
-- mensagem escrita no próprio código — não foram religados a esta tabela
-- nesta entrega, pra não arriscar quebrar automações já em produção.

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  category text not null check (category in ('confirmacao_d1', 'falta', 'cobranca', 'aniversario', 'renovacao_guia', 'outro')),
  name text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms')),
  body text not null,
  -- flag manual: fica marcado quando o gestor aprovou o texto no Console da Meta/Twilio por fora do sistema — não há integração real com a API de aprovação de templates.
  meta_approved boolean not null default false,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table message_templates enable row level security;

create policy message_templates_read on message_templates
  for select using (clinic_id = current_clinic_id() and app_current_role() in ('gestor', 'supervisor', 'recepcao'));

create policy message_templates_manage on message_templates
  for all using (clinic_id = current_clinic_id() and app_current_role() = 'gestor')
  with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');
