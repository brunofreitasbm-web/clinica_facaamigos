-- supabase/migrations/20260910050000_site_leads_convenio.sql
-- "Vocês atendem qual plano de saúde?" é a pergunta que mais chega pelo
-- WhatsApp (é por isso que lib/twilio-faq-bot.ts já responde com a lista de
-- `insurers` ativos). A landing pública (app/site) passa a fazer a mesma
-- pergunta em formulário: quem quer saber do convênio deixa o dado, e a
-- dúvida vira lead em vez de virar mensagem que ninguém registrou.
--
-- As três colunas abaixo são o que a recepção precisa saber ANTES de ligar,
-- e o que o fluxo do chatbot usa para decidir o próximo passo:
--   convenio_id   → casou com um convênio credenciado da clínica;
--   convenio_nome → o que a família digitou quando o plano dela não está na
--                   lista (ou "particular") — é o dado que diz qual convênio
--                   vale a pena credenciar;
--   tem_guia      → bifurcação do atendimento: com guia/pedido médico em mãos
--                   a recepção já agenda; sem guia, o fluxo é orientar como
--                   conseguir; "não sei" é o caso mais comum e precisa de
--                   explicação antes de qualquer agendamento.
--
-- Tudo nullable de propósito: o formulário de contato geral continua válido
-- sem nenhum desses campos, e lead antigo não pode ser invalidado por coluna
-- nova. A escrita segue passando por service-role na Server Action
-- (app/site/actions.ts) — não há, e não deve haver, policy de insert para
-- `anon` aqui.

alter table site_leads
  add column convenio_id uuid references insurers(id),
  add column convenio_nome text
    check (convenio_nome is null or char_length(convenio_nome) <= 120),
  add column tem_guia text
    check (tem_guia is null or tem_guia in ('sim', 'nao', 'nao_sei'));

comment on column site_leads.convenio_id is
  'Convênio credenciado que a família escolheu na lista do site. Nulo quando o plano dela não está entre os credenciados — nesse caso o nome digitado fica em convenio_nome.';
comment on column site_leads.convenio_nome is
  'Plano digitado pela família quando não está na lista de credenciados, ou "Particular". É a fila de demanda por novos credenciamentos.';
comment on column site_leads.tem_guia is
  'A família já tem guia/pedido médico em mãos: sim | nao | nao_sei. Define o fluxo de contato antes de agendar a primeira avaliação.';

-- A pergunta "quais planos as famílias procuram e a gente não atende?" é um
-- relatório de gestão, não uma varredura da fila inteira.
create index idx_site_leads_convenio on site_leads (clinic_id, convenio_id, created_at desc);
