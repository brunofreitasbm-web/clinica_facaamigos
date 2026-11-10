-- Fila de entrada (etapa 3): o plano pode responder com uma negativa ou com um
-- pedido de mais documentos, além da autorização. A recepção registra aqui o
-- que o plano respondeu:
--   - "Plano negou": o caso volta para a etapa 2 (enviar a guia de novo) e para
--     o grupo "Agir agora". A ação limpa guide_sent_at; reenviar a guia grava um
--     guide_sent_at mais novo que plan_denied_at, e a negativa deixa de valer.
--   - "Plano pediu mais documentos": o caso volta para a etapa 1 (cobrar a
--     família). Vale até a guia ser reenviada depois do pedido.
-- As duas marcas também deixam de valer quando o plano autoriza (ver
-- activePlanOutcome em lib/intake-queue-build-pure.ts). Só a equipe vê esses
-- campos; nada aqui é enviado à família.

alter table registration_drafts
  add column if not exists plan_denied_at timestamptz,
  add column if not exists plan_denied_by uuid references profiles(id),
  add column if not exists plan_more_docs_at timestamptz,
  add column if not exists plan_more_docs_by uuid references profiles(id);

comment on column registration_drafts.plan_denied_at is
  'Quando a recepção registrou que o plano negou a guia. Deixa de valer quando a guia é reenviada depois disso (guide_sent_at mais novo) ou o plano autoriza.';
comment on column registration_drafts.plan_denied_by is
  'Quem registrou a negativa do plano.';
comment on column registration_drafts.plan_more_docs_at is
  'Quando a recepção registrou que o plano pediu mais documentos. Deixa de valer quando a guia é reenviada depois disso ou o plano autoriza.';
comment on column registration_drafts.plan_more_docs_by is
  'Quem registrou o pedido de mais documentos do plano.';
