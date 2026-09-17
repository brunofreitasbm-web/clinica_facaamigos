-- Catálogo de motivos de glosa por convênio (hoje `glosas.reason_code` é
-- texto livre — ver supabase/migrations/20260904000009_billing.sql — o que
-- deixa cada faturista digitar um texto diferente pro mesmo motivo e
-- esvazia `glosa_recurring_patterns`, que agrupa por reason_code exato).
-- Esta tabela não substitui reason_code (permanece texto livre, inclusive
-- pra motivos fora do catálogo e pra import de CSV com reason_code='CSV'),
-- é só a lista de referência oferecida na UI — mesmo espírito "alerta, não
-- trava" já adotado para os limites de sessão em insurer_price_tables.

create table glosa_reason_catalog (
  id uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references insurers(id) on delete cascade,
  code text not null,
  description text not null,
  category text not null check (category in (
    'autorizacao_previa',
    'prazo',
    'documentacao',
    'identificacao_profissional',
    'assinatura_beneficiario',
    'guia_incompleta',
    'anexos_obrigatorios'
  )),
  prevention_hint text not null,
  active boolean not null default true,
  unique (insurer_id, code)
);

comment on table glosa_reason_catalog is
  'Referência de motivos de glosa por convênio (ex.: Anexo V do contrato PROASA — Glosas Permitidas), com dica de prevenção exibida no lançamento/registro de glosa.';

alter table glosa_reason_catalog enable row level security;

create policy glosa_reason_catalog_read on glosa_reason_catalog for select
  using (
    app_current_role() in ('gestor','faturamento','recepcao','supervisor')
    and exists (select 1 from insurers i where i.id = glosa_reason_catalog.insurer_id and i.clinic_id = current_clinic_id())
  );

create policy glosa_reason_catalog_manage_gestor on glosa_reason_catalog for all
  using (
    app_current_role() = 'gestor'
    and exists (select 1 from insurers i where i.id = glosa_reason_catalog.insurer_id and i.clinic_id = current_clinic_id())
  );

do $$
declare
  r record;
begin
  for r in (select id from insurers where upper(trim(name)) ilike '%PROASA%') loop
    insert into glosa_reason_catalog (insurer_id, code, description, category, prevention_hint)
    values
      (r.id, 'PROASA-01', 'Procedimento eletivo sem autorização prévia (Anexo V, item 1)', 'autorizacao_previa',
        'Nunca realizar procedimento eletivo sem autorização ativa no Autorizador Web antes do atendimento.'),
      (r.id, 'PROASA-02', 'Cobrança em discordância com o contrato / fatura ou recurso fora do prazo (Anexo V, item 2)', 'prazo',
        'Faturar em até 90 dias do atendimento; recurso de glosa em até 30 dias da comunicação ou do pagamento, o que ocorrer primeiro.'),
      (r.id, 'PROASA-03', 'Alteração ou rasura na documentação apresentada (Anexo V, item 3)', 'documentacao',
        'Conferir guia/laudo sem emendas antes de anexar ao faturamento; refazer documento rasurado.'),
      (r.id, 'PROASA-04', 'Identificação profissional incompleta nos registros (Anexo V, item 4)', 'identificacao_profissional',
        'Confirmar nome completo e registro do conselho de classe (CRP/CREFITO/CRN/CRFa) preenchidos na guia/relatório.'),
      (r.id, 'PROASA-05', 'Guia sem assinatura do beneficiário ou carimbo do profissional (Anexo V, item 5)', 'assinatura_beneficiario',
        'Não liberar checkout/faturamento sem assinatura do beneficiário (ou responsável) e carimbo do profissional na guia.'),
      (r.id, 'PROASA-06', 'Guia não devidamente preenchida (Anexo V, item 6)', 'guia_incompleta',
        'Revisar todos os campos obrigatórios da guia TISS antes do envio.'),
      (r.id, 'PROASA-07', 'Documentação exigida pelos Anexos III/III.A/III.B/III.C/IV não enviada (Anexo V, item 7)', 'anexos_obrigatorios',
        'Fono/Psico/TO: pedido médico + guia assinada + recibo por sessão. Nutrição: pedido médico + guia. Fisioterapia: relatório a cada 10 sessões.'),
      (r.id, 'PROASA-08', 'Autorização não anexada ao faturamento (Anexo V, item 8)', 'anexos_obrigatorios',
        'Confirmar que a autorização/guia está anexada no Portal (Autorizador Web) antes de fechar a competência.')
    on conflict (insurer_id, code) do nothing;
  end loop;
end $$;
