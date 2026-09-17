-- Cadastro do convênio PROASA (contrato nº 12473, vigência 25/01/2024) a
-- partir dos Anexos I/II/III/III.A/III.B/III.C/IV: procedimentos (código
-- TUSS, valor, duração) e regras de autorização/limite de sessões por
-- procedimento. As colunas novas são informativas/de alerta (a clínica
-- decidiu não bloquear lançamento por regra de sessão — ver
-- app_current_role()/appointments_authorization_guard, que já bloqueia por
-- saldo/vigência da guia em si; isto aqui é o "quanto" e "até quando" pra
-- exibir alerta, não uma trava nova).

alter table insurer_price_tables
  add column duration_minutes int,
  add column requires_prior_authorization boolean not null default true,
  add column max_sessions_per_guide int,
  add column medical_order_validity_months int,
  add column guide_validity_days int,
  add column session_frequency_note text,
  add column escalation_rule text;

comment on column insurer_price_tables.max_sessions_per_guide is
  'Quantidade de sessões autorizadas por guia (ex.: 10 para fono/psico/TO). Alerta, não trava.';
comment on column insurer_price_tables.medical_order_validity_months is
  'Validade do pedido médico em meses; expirado exige novo pedido + relatório do profissional.';
comment on column insurer_price_tables.guide_validity_days is
  'Validade da guia de autorização emitida, em dias, para realização das sessões.';
comment on column insurer_price_tables.session_frequency_note is
  'Regra de frequência que não vira constraint de banco (ex.: "1 sessão/semana — exceção exige justificativa").';
comment on column insurer_price_tables.escalation_rule is
  'Escada de exigências por volume de sessões (ex.: fisioterapia 10→20→30 sessões: relatório, reavaliação médica, segunda opinião).';

do $$
declare
  v_insurer_id uuid;
begin
  insert into insurers (clinic_id, name, ans_code, billing_rules)
  select
    'c0000000-0000-0000-0000-000000000001',
    'PROASA',
    '31.052-2',
    jsonb_build_object(
      'contrato_numero', '12473',
      'vigencia_inicio', '2024-01-25',
      'prazo_faturamento_dias', 90,
      'prazo_recurso_glosa_dias', 30,
      'dia_pagamento_mes', 15,
      'prazo_anexo_nota_fiscal_dia', 12,
      'prazo_max_pendencia_nota_fiscal_dias', 60,
      'multa_atraso_pagamento_pct', 2,
      'juros_mora_mes_pct', 1,
      'multa_infracao_contratual_pct', 10,
      'portal_autorizador', 'https://producao-mv.proasa.org.br/mvautorizadorguias/',
      'horario_atendimento_solicitacoes', 'Segunda a quinta 8h-17h15, sexta 8h-12h; fora disso, análise no próximo dia útil',
      'telefone_emergencia_24h', '(61) 3701-1800',
      'email_autorizacao', 'autorizacao@proasa.org.br',
      'email_financeiro', 'fiscal@proasa.org.br',
      'tempos_maximos_atendimento_dias', jsonb_build_object(
        'consulta_basica', 7,
        'consulta_demais_especialidades', 14,
        'consulta_fonoaudiologia', 10,
        'consulta_nutricao', 10,
        'consulta_psicologia', 10,
        'sessao_terapia_ocupacional', 10,
        'sessao_fisioterapia', 10,
        'diagnostico_laboratorio', 3,
        'diagnostico_imagem', 10,
        'alta_complexidade', 21
      )
    )
  where not exists (
    select 1 from insurers
    where clinic_id = 'c0000000-0000-0000-0000-000000000001' and name = 'PROASA'
  );

  select id into v_insurer_id from insurers
  where clinic_id = 'c0000000-0000-0000-0000-000000000001' and name = 'PROASA';

  -- Anexo II — Critérios de Remuneração + Anexo III/III.A/III.B/III.C/IV —
  -- regras de autorização seriada por especialidade.
  insert into insurer_price_tables (
    insurer_id, procedure_code, procedure_name, price, valid_from,
    duration_minutes, requires_prior_authorization, max_sessions_per_guide,
    medical_order_validity_months, guide_validity_days, session_frequency_note, escalation_rule
  )
  values
    (v_insurer_id, '9922200008', 'Consulta/sessão de terapia ocupacional - método ABA', 90.00, '2024-01-25',
      55, true, 10, 6, 90, 'Codificação para pacientes autistas; quantidade conforme pedido médico com CID.', null),
    (v_insurer_id, '50001221', 'Consulta ambulatorial em psicologia', 45.00, '2024-01-25',
      35, true, 10, 6, 90, 'Limitado a 1 sessão/semana; exceção exige justificativa (auditoria pós-faturamento).', null),
    (v_insurer_id, '50000470', 'Sessão de psicoterapia individual por psicólogo', 45.00, '2024-01-25',
      40, true, 10, 6, 90, 'Limitado a 1 sessão/semana; exceção exige justificativa (auditoria pós-faturamento).', null),
    (v_insurer_id, '50000586', 'Consulta ambulatorial de fonoaudiologia', 45.00, '2024-01-25',
      35, true, 10, 6, 90, null, null),
    (v_insurer_id, '50000616', 'Sessão individual ambulatorial de fonoaudiologia', 45.00, '2024-01-25',
      35, true, 10, 6, 90, null, null),
    (v_insurer_id, '50000055', 'Consulta individual ambulatorial em terapia ocupacional', 45.00, '2024-01-25',
      35, true, 10, 6, 90, null, null),
    (v_insurer_id, '50000080', 'Sessão individual ambulatorial em terapia ocupacional', 45.00, '2024-01-25',
      35, true, 10, 6, 90, null, null),
    (v_insurer_id, '50000560', 'Consulta ambulatorial por nutricionista', 50.00, '2024-01-25',
      35, true, null, null, null,
      'Não é seriada (guia SADT Tipo 2). Até 6 consultas/ano com o mesmo pedido, 1 a cada 30 dias. Mais de 1/mês exige auditoria técnica.', null),
    (v_insurer_id, '41301048', 'Bioimpedanciometria (ambulatorial) exame', 30.00, '2024-01-25',
      null, true, null, null, null, null, null),
    (v_insurer_id, '20103646', 'Reabilitação perineal com biofeedback', 50.00, '2024-01-25',
      null, true, null, null, null, null, null),
    (v_insurer_id, '31601014', 'Acupuntura por sessão', 40.00, '2024-01-25',
      null, true, null, null, null, null, null),
    (v_insurer_id, '50000144', 'Consulta ambulatorial em fisioterapia', 30.00, '2024-01-25',
      null, true, null, null, 90, 'DUT nº102: 2 consultas por CID apresentado ao ano.', null),
    (v_insurer_id, '50000160', 'Atend. fisioterapêutico ambulatorial — disfunção músculo-esquelética', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000233', 'Atend. fisioterapêutico ambulatorial — genito-urinário/reprodutor/proctológico', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000713', 'Atend. fisioterapêutico ambulatorial — lesão SNC/periférico (independente/dep. parcial)', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000730', 'Atend. fisioterapêutico ambulatorial individual — disfunção respiratória', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000195', 'Atend. fisioterapêutico ambulatorial — disfunção por queimaduras', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000209', 'Atend. fisioterapêutico ambulatorial — disfunção linfático/vascular periférico', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000217', 'Atend. fisioterapêutico ambulatorial — pré/pós cirúrgico e recuperação de tecidos', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000721', 'Atend. fisioterapêutico ambulatorial — lesão SNC/periférico (dependente)', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.'),
    (v_insurer_id, '50000756', 'Atend. fisioterapêutico ambulatorial individual — disfunção cardiovascular', 30.00, '2024-01-25',
      null, true, 10, 6, 90, 'Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).',
      'Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.')
  on conflict do nothing;
end $$;
