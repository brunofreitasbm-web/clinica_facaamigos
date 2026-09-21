-- Leads do bot de agendamento na fila de Pendências, com "o que falta" à vista.
--
-- Até aqui só nascia `registration_drafts` quando um telefone desconhecido mandava
-- mídia sem bot esperando. Quem passava pelo bot de agendamento (nome, CPF,
-- e-mail, criança...) ficava só em chatbot_sessions.collected_data — que é zerada
-- ao responder "não tenho laudo" ou ao concluir — e não aparecia em Pendências.
-- Agora o bot espelha cada passo no rascunho do telefone (lib/registration-drafts-bot.ts).
--
-- bot_collected: o que o responsável DIGITOU no bot (nome, CPF, e-mail, criança,
--   nascimento, particular/convênio, nº do cartão, ponteiros dos documentos,
--   "não tenho laudo"). Acumula entre passos e sobrevive ao reset da sessão.
--
-- Índice único parcial: no máximo UM rascunho aberto do WhatsApp por telefone
-- (o bot e a mídia solta disputam o mesmo rascunho; sem isso, duas entregas
-- simultâneas criam dois cartões para o mesmo contato). Antes de aplicar, rode:
--   select source_phone, count(*) from registration_drafts
--   where source = 'whatsapp' and status in ('pending','processing','extracted','failed')
--   group by 1 having count(*) > 1;
-- e consolide (mantenha o mais recente, rejeite os demais) — senão o CREATE INDEX falha.

alter table registration_drafts add column if not exists bot_collected jsonb;

create unique index if not exists registration_drafts_one_open_whatsapp
  on registration_drafts (source_phone)
  where source = 'whatsapp' and status in ('pending', 'processing', 'extracted', 'failed');
