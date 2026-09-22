-- Entre "documentos recebidos" e "plano autorizou" existe um passo manual,
-- fora do sistema da clínica: alguém pega a guia de autorização e ENVIA ao
-- plano (portal, e-mail, telefone). Sem esse check, recepção/supervisão/
-- gestão não sabem se o pedido já saiu da clínica ou ainda está parado.
-- Linha do tempo passa a ter 4 etapas:
--   1) documentos recebidos
--   2) guia enviada ao plano        (esta migration)
--   3) plano autorizou               (já existia: plan_authorized_at)
--   4) habilitado para agendamento   (já existia: scheduling_enabled_at)

alter table registration_drafts
  add column guide_sent_at timestamptz,
  add column guide_sent_by uuid references profiles(id);

comment on column registration_drafts.guide_sent_at is
  'Etapa 2 da fila de pendências: a clínica enviou a guia de autorização ao plano (processo manual, fora do sistema).';

-- Quem já foi autorizado obviamente teve a guia enviada antes — não deixar
-- esses contatos "travados" numa etapa 2 que nunca foi marcada.
update registration_drafts
   set guide_sent_at = plan_authorized_at,
       guide_sent_by = plan_authorized_by
 where plan_authorized_at is not null
   and guide_sent_at is null;
