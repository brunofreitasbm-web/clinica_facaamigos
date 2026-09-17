-- Checklist documental por guia (Anexo V do contrato PROASA reúne a
-- maioria dos motivos de glosa em documentação, não em regra de
-- procedimento: rasura, assinatura do beneficiário, carimbo do
-- profissional, relatório periódico). Cadastrar só "procedimentos" e
-- "motivos de glosa" como texto não previne essas glosas — o checklist é o
-- controle que de fato reduz o risco. É informativo/alerta (não bloqueia
-- appointments_authorization_guard nem billing_items_requires_session_note,
-- que já são as travas reais existentes) — a equipe marca conforme concluído
-- e o painel de faturamento pode destacar guias com pendência.

alter table authorizations
  add column beneficiary_signed boolean not null default false,
  add column professional_stamped boolean not null default false,
  add column authorization_document_attached boolean not null default false,
  add column last_progress_report_sent_at timestamptz;

comment on column authorizations.beneficiary_signed is
  'Guia assinada pelo beneficiário (ou responsável) — Anexo V, item 5.';
comment on column authorizations.professional_stamped is
  'Guia com carimbo/identificação completa do profissional — Anexo V, itens 4 e 5.';
comment on column authorizations.authorization_document_attached is
  'Autorização/guia anexada no Portal antes do faturamento — Anexo V, item 8.';
comment on column authorizations.last_progress_report_sent_at is
  'Data do último relatório de evolução enviado (obrigatório a cada 10 sessões nos protocolos seriados — Anexo IV).';

-- View de risco de glosa: guias ativas do PROASA com checklist incompleto ou
-- relatório de evolução atrasado (usa max_sessions_per_guide da tabela de
-- preços pra estimar quando o relatório de 10 sessões é devido). Puramente
-- de leitura — mesma filosofia analítica de glosa_recurring_patterns
-- (20260906000017), sem escrita automática.
create view authorization_documentation_risk as
select
  a.id as authorization_id,
  a.guide_number,
  a.procedure_code,
  a.sessions_used,
  a.sessions_authorized,
  a.valid_to,
  pi.patient_id,
  i.id as insurer_id,
  i.name as insurer_name,
  a.beneficiary_signed,
  a.professional_stamped,
  a.authorization_document_attached,
  a.last_progress_report_sent_at,
  (
    not a.beneficiary_signed
    or not a.professional_stamped
    or not a.authorization_document_attached
  ) as checklist_incomplete,
  (
    a.sessions_used > 0
    and a.sessions_used % 10 = 0
    and (a.last_progress_report_sent_at is null or a.last_progress_report_sent_at < now() - interval '10 days')
  ) as progress_report_overdue
from authorizations a
join patient_insurance pi on pi.id = a.patient_insurance_id
join insurers i on i.id = pi.insurer_id
where a.status = 'ativa';

comment on view authorization_documentation_risk is
  'Alerta não-bloqueante de risco de glosa documental por guia ativa (checklist incompleto ou relatório de evolução atrasado). RLS efetiva via security_invoker, herdada das tabelas-base.';

alter view authorization_documentation_risk set (security_invoker = true);
