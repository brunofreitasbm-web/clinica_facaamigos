-- Migração de metodologia de pagamento PJ: de "hora × valor-hora por
-- sessão realizada" para "preço fechado por Módulo Assistencial entregue",
-- conforme cláusula 6ª do contrato-quadro PJ–PJ da clínica.
--
-- `hourly_rate` vira legado: contratos já cadastrados continuam com ele
-- preenchido (payouts já fechados sob esse regime ficam congelados, sem
-- recálculo retroativo — decisão de produto). Todo contrato NOVO passa a
-- usar `module_price` + os 3 parâmetros do módulo; a UI
-- (app/gestor/configuracoes/profissionais) para de oferecer o campo
-- hourly_rate. O check abaixo garante XOR entre os dois modelos por linha.
alter table therapist_contracts
  alter column hourly_rate drop not null,
  add column module_price numeric(10,2),
  add column attendances_per_module int not null default 6,
  add column doc_deadline_days int not null default 3,
  add column noshow_compensation_pct numeric(5,2) not null default 50,
  add constraint therapist_contracts_pricing_model_chk
    check (
      (hourly_rate is not null and module_price is null)
      or (hourly_rate is null and module_price is not null)
    ),
  add constraint therapist_contracts_attendances_per_module_chk
    check (attendances_per_module > 0),
  add constraint therapist_contracts_doc_deadline_chk
    check (doc_deadline_days > 0),
  add constraint therapist_contracts_noshow_pct_chk
    check (noshow_compensation_pct >= 0 and noshow_compensation_pct <= 100);

comment on column therapist_contracts.hourly_rate is
  'Legado — modelo de pagamento por hora, descontinuado em 2026-09-10. Mantido só para preservar contratos/payouts históricos já fechados. Novos contratos usam module_price.';
comment on column therapist_contracts.module_price is
  'Preço unitário fechado por Módulo Assistencial efetivamente entregue (cláusula 6ª do contrato-quadro PJ–PJ) — não proporcional a horas ou atendimentos.';
comment on column therapist_contracts.attendances_per_module is
  'Limite de atendimentos (mesmo período matutino/vespertino, mesmo dia) que compõem um Módulo Assistencial.';
comment on column therapist_contracts.doc_deadline_days is
  'Prazo em dias para a documentação técnica do módulo ser considerada entregue (derivado automaticamente de session_notes).';
comment on column therapist_contracts.noshow_compensation_pct is
  'Percentual do preço do módulo devido como indenização civil quando o módulo inteiro é esvaziado por falta com aviso < 24h.';
