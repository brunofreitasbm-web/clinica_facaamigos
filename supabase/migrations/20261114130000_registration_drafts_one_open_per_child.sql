-- "Ajustar cadastro > Separar irmão": o irmão precisa de um rascunho PRÓPRIO e ABERTO (status 'extracted')
-- para entrar na Fila de entrada e seguir o fluxo dele (documentos, guia, autorização, agendamento).
-- O índice único antigo (registration_drafts_one_open_whatsapp) permitia um único rascunho aberto por
-- telefone, então o irmão só conseguia ser gravado como 'validated', que nenhuma fila lê, e (por isso)
-- recebia a autorização do contato de origem em vez de passar pelo plano. O mesmo índice também fazia o
-- split automático de irmãos (lib/draft-split-db.ts) falhar em silêncio quando o rascunho original estava aberto.
--
-- Novo critério: um rascunho aberto por telefone E por criança. Rascunho sem paciente vinculado continua
-- limitado a UM por telefone (coalesce para um uuid fixo), que é o que protege o bot e o ingest de mídia
-- contra a corrida de dois cartões para o mesmo contato.
--
-- Seguro de aplicar: o índice novo é MAIS FROUXO que o antigo, então nenhum dado existente o viola. O novo é
-- criado antes de remover o antigo para a proteção nunca ficar descoberta.

create unique index if not exists registration_drafts_one_open_whatsapp_per_child
  on registration_drafts (source_phone, coalesce(patient_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where source = 'whatsapp' and status in ('pending', 'processing', 'extracted', 'failed');

drop index if exists registration_drafts_one_open_whatsapp;
