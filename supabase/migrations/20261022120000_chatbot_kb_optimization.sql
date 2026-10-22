-- supabase/migrations/20261022120000_chatbot_kb_optimization.sql
-- Otimização da base de conhecimento do chatbot de WhatsApp, a partir da leitura
-- de 42 dias de conversas reais (docs/chatbot-base-conhecimento-auditoria.md).
--
--  1. Schema: clinic_faq.audience (lead | paciente | ambos) e
--     chatbot_settings.agenda_status_note (situação da agenda mantida pela gestão).
--  2. Dados: corrige as respostas que se contradiziam ou iam erradas à família.
--     Só entra aqui o que tem fonte (resposta da própria recepção, site oficial ou
--     regra do prompt). O que depende de decisão do dono (adultos, horário oficial,
--     valor da avaliação, visita, terapias cobertas pelo IASEP) NÃO foi inventado.
--  3. Views de KPI com comparativo (semana atual vs. anterior) e a lista de
--     perguntas que o bot não soube responder — alimentam a aba Chatbot.
--
-- Idempotente: pode ser reaplicada sem duplicar nada.

-- =====================================================================
-- 1. Schema
-- =====================================================================
alter table clinic_faq
  add column if not exists audience text not null default 'ambos'
  check (audience in ('lead', 'paciente', 'ambos'));

comment on column clinic_faq.audience is
  'Quem recebe esta entrada no prompt do bot: lead (número sem cadastro), paciente (responsável cadastrado) ou ambos.';

alter table chatbot_settings
  add column if not exists agenda_status_note text;

comment on column chatbot_settings.agenda_status_note is
  'Situação atual da agenda em 1-3 frases (ex.: "agenda em montagem; previsão de início em novembro"). Entra no prompt como a única fonte sobre vagas e prazos.';

-- =====================================================================
-- 2. Dados (clínica única: c0000000-0000-0000-0000-000000000001)
-- =====================================================================

-- 2.1 Entradas que só fazem sentido para quem já é paciente (falam de portal da
-- família, recibo emitido a cada pagamento e remarcação de sessão marcada).
update clinic_faq
set audience = 'paciente', updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question in (
    'Qual a política de faltas?',
    'Emitem recibo do pagamento?',
    'Como faço para desmarcar ou remarcar?'
  );

-- 2.2 Telefone: a resposta era o marcador "⚠️ TODO" e foi enviada a uma família
-- em 20/10/2026. WhatsApp e e-mail oficiais constam do site institucional e da
-- migration 20260913210000 (que nunca foi aplicada em produção).
update clinic_faq
set answer = 'Você pode falar com a gente por este mesmo WhatsApp, (91) 99178-2027 📞, ou pelo e-mail institutofacaamigos@gmail.com.',
    active = true,
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Qual o telefone para contato?'
  and answer like '%TODO%';

-- 2.3 Currículo: duplicava e contradizia o fluxo de emprego do código
-- (lib/job-inquiry-pure.ts), que responde uma vez, com o link direto, e
-- encerra. Desativada, não apagada.
update clinic_faq
set active = false, updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Estão Contratando? Ou recebendo currículos?';

-- 2.4 (Convênios com {{convenios}}): migration 20261022120100, aplicada DEPOIS do deploy do código.

-- 2.5 Guia: a FAQ dizia que a guia precisa estar validada ANTES e que sem ela não
-- se libera o horário; a recepção (e a regra 12 do prompt) fazem o contrário:
-- pedem laudo + carteirinha + documento e SOLICITAM a autorização ao plano.
update clinic_faq
set answer = 'Você não precisa ter a guia em mãos 😊 Pelo convênio, a clínica solicita a autorização ao plano com o laudo ou pedido médico, a foto da carteirinha (frente e verso) e o documento do paciente, e avisa por aqui quando sair. A primeira sessão é marcada depois da autorização. Para atendimento particular não é necessário nada disso. 📋',
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Preciso de guia autorizada para psicoterapia pelo convênio?';

-- 2.6 Laudo de TEA: mesma correção da migration 20261006120000 (não aplicada em
-- produção): pelo particular o laudo não é obrigatório; pelo convênio o plano
-- pede laudo ou pedido médico com CID.
update clinic_faq
set answer = 'Atendemos sim, com muito carinho. Nossa equipe é especializada em desenvolvimento infantil e atende crianças com TEA, atraso de fala, dificuldades de aprendizagem e questões sensoriais. Pelo *particular*, o laudo não é obrigatório para começar. Pelo *convênio*, o plano pede o laudo ou pedido médico (com CID) para autorizar. 💛',
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Meu filho tem laudo de TEA (autismo). Vocês atendem?';

-- 2.7 Terapias: a lista tinha 5 itens, mas o catálogo ativo (appointment_types e
-- tabela de preços particular) também tem Psicopedagogia, Musicoterapia e
-- Psicomotricidade. O fecho "Quer que eu te explique alguma delas?" levava a
-- uma pergunta que a base não sabe responder; agora pede o dado útil.
update clinic_faq
set answer = E'Somos uma equipe multidisciplinar de desenvolvimento infantil. Atendemos:\n\n🔹 *Fonoaudiologia*\n🔹 *Terapia Ocupacional* (inclusive Integração Sensorial e AVD)\n🔹 *Psicologia ABA*\n🔹 *Psicoterapia*\n🔹 *Neuropsicologia* e Avaliação Neuropsicológica\n🔹 *Psicopedagogia*\n🔹 *Musicoterapia*\n🔹 *Psicomotricidade*\n\nMe conta qual terapia você procura e o plano de saúde da criança (ou se é particular) que eu te oriento. 💛',
    updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question = 'Que terapias vocês oferecem?';

-- 2.8 Entradas novas, todas com fonte: respostas reais da recepção a leads
-- (set–out/2026), o site oficial e o prompt. Cada uma cobre uma pergunta que
-- apareceu várias vezes e nunca teve resposta na base.
insert into clinic_faq (clinic_id, question, answer, keywords, category, sort_order, audience)
select 'c0000000-0000-0000-0000-000000000001', v.question, v.answer, v.keywords, v.category, v.sort_order, v.audience
from (values
  (
    'Quais documentos preciso mandar para agendar?',
    E'Pelo *convênio*, precisamos de:\n🔹 laudo ou pedido médico (com CID);\n🔹 foto da carteirinha do plano (frente e verso);\n🔹 documento do paciente (RG ou certidão de nascimento).\n\nA guia autorizada *não* é obrigatória: a clínica solicita a autorização ao plano. Pode mandar uma foto ou PDF de cada vez, por aqui mesmo. No *particular*, não precisa de nada disso. 📋',
    array['documentos', 'documento', 'quais documentos', 'o que preciso levar', 'o que mandar', 'rg', 'certidao', 'pedido medico'],
    'regras', 41, 'lead'
  ),
  (
    'Como funciona, do primeiro contato até a primeira sessão?',
    E'Pelo *convênio*:\n1️⃣ você envia os documentos por aqui;\n2️⃣ a clínica solicita a autorização ao plano;\n3️⃣ avisamos por aqui quando sair a autorização;\n4️⃣ marcamos a primeira sessão, que é a *avaliação inicial* com o supervisor.\n\nNo *particular*, a recepção combina a data da avaliação inicial com você. Depois dela, a equipe monta o plano terapêutico (PTS). 💙',
    array['como funciona o processo', 'passo a passo', 'primeiro contato', 'proximo passo', 'primeira sessao', 'como faco para comecar', 'como eu comeco'],
    'regras', 42, 'lead'
  ),
  (
    'O meu plano não é atendido. O que eu faço?',
    'Hoje não atendemos esse plano diretamente, mas você pode seguir pelo *atendimento particular*. Emitimos nota fiscal e relatório dos serviços para você dar entrada no reembolso junto à operadora, conforme os trâmites do seu plano. Posso te passar os valores particulares por terapia, se quiser. 💛',
    array['unimed', 'hapvida', 'amazonia saude', 'bradesco', 'sulamerica', 'cassi', 'plano nao atendido', 'nao atendem meu plano', 'sus'],
    'convenios', 12, 'ambos'
  ),
  (
    'Como funciona o reembolso do plano de saúde?',
    'Para os planos que não atendemos diretamente, entregamos a *nota fiscal* e o *relatório* dos atendimentos, e você dá entrada no pedido de reembolso junto à operadora, conforme os trâmites de cada plano. O prazo e o percentual reembolsado dependem do seu plano. 🧾',
    array['como funciona o reembolso', 'pedir reembolso', 'reembolso do plano', 'nota fiscal', 'relatorio de reembolso'],
    'convenios', 13, 'ambos'
  ),
  (
    'O que é o Mapeamento Comportamental?',
    'É um questionário *gratuito e educativo* do nosso site: cerca de 5 minutos, 25 perguntas, para crianças de 4 a 17 anos. Ele gera um retrato do dia a dia da criança na tela e no seu e-mail. *Não é diagnóstico* e não substitui a avaliação profissional. Se quiser conversar sobre o resultado com a nossa equipe, é só me contar. 🧩',
    array['mapeamento', 'mapeamento comportamental', 'questionario', 'teste do site', 'retrato'],
    'outro', 140, 'ambos'
  )
) as v(question, answer, keywords, category, sort_order, audience)
where not exists (
  select 1 from clinic_faq f
  where f.clinic_id = 'c0000000-0000-0000-0000-000000000001' and f.question = v.question
);

-- =====================================================================
-- 3. KPIs do chatbot, com comparativo (semana atual vs. anterior)
-- =====================================================================
-- Mesmo padrão de metabase_ux_friction_kpis: o prefixo "metabase_" é só herança
-- de nome — a leitura é pela tela do gestor, sem ferramenta paga. RLS pela
-- security_invoker nas tabelas-base (messages, twilio_conversations).
create or replace view metabase_chatbot_kpis_semanais with (security_invoker = true) as
with msg as (
  select
    c.clinic_id, m.sender_type, m.intent,
    date_trunc('week', m.sent_at at time zone 'America/Belem')::date as semana
  from messages m
  join twilio_conversations c on c.id = m.conversation_id
  where m.channel = 'whatsapp'
),
agg as (
  select
    clinic_id, semana,
    count(*) filter (where sender_type = 'user') as msgs_familia,
    count(*) filter (where sender_type = 'bot') as respostas_bot,
    count(*) filter (where sender_type = 'agent') as respostas_humanas,
    count(*) filter (where sender_type = 'bot' and intent = 'atendimento_geral') as fallbacks,
    count(*) filter (where sender_type = 'bot' and intent = 'ia_indisponivel') as ia_indisponivel,
    count(*) filter (where sender_type = 'bot' and intent like 'faq\_regra\_%') as respostas_por_regra,
    count(*) filter (where sender_type = 'bot' and intent like 'escalado\_%') as escalonamentos
  from msg
  group by clinic_id, semana
),
conv as (
  select
    c.clinic_id,
    date_trunc('week', fi.t at time zone 'America/Belem')::date as semana,
    count(*) as conversas_novas,
    count(*) filter (where exists (
      select 1 from messages a
      where a.conversation_id = c.id and a.channel = 'whatsapp' and a.sender_type = 'agent'
    )) as conversas_com_resposta_humana
  from twilio_conversations c
  cross join lateral (
    select min(u.sent_at) as t
    from messages u
    where u.conversation_id = c.id and u.channel = 'whatsapp' and u.sender_type = 'user'
  ) fi
  where fi.t is not null
  group by c.clinic_id, date_trunc('week', fi.t at time zone 'America/Belem')::date
),
base as (
  select
    a.clinic_id, a.semana, a.msgs_familia, a.respostas_bot, a.respostas_humanas,
    a.fallbacks, a.ia_indisponivel, a.respostas_por_regra, a.escalonamentos,
    coalesce(v.conversas_novas, 0) as conversas_novas,
    coalesce(v.conversas_com_resposta_humana, 0) as conversas_com_resposta_humana,
    round(100.0 * a.fallbacks / nullif(a.msgs_familia, 0), 1) as pct_fallback,
    round(100.0 * a.respostas_por_regra / nullif(a.respostas_bot, 0), 1) as pct_regras,
    round(100.0 * coalesce(v.conversas_com_resposta_humana, 0) / nullif(v.conversas_novas, 0), 1) as pct_conversas_com_humano
  from agg a
  left join conv v on v.clinic_id = a.clinic_id and v.semana = a.semana
)
select
  b.clinic_id,
  b.semana,
  (b.semana = date_trunc('week', now() at time zone 'America/Belem')::date) as semana_em_andamento,
  b.msgs_familia, b.respostas_bot, b.respostas_humanas, b.fallbacks, b.ia_indisponivel,
  b.respostas_por_regra, b.escalonamentos, b.conversas_novas, b.conversas_com_resposta_humana,
  -- Fallback: resposta genérica de boas-vindas dada a uma pergunta que o bot não soube tratar.
  b.pct_fallback                       as pct_fallback_atual,
  p.pct_fallback                       as pct_fallback_semana_anterior,
  round(b.pct_fallback - p.pct_fallback, 1) as variacao_fallback_pp,
  3.0::numeric                         as meta_max_pct_fallback,
  -- Respostas pela camada de regras (sem IA, custo zero).
  b.pct_regras                         as pct_regras_atual,
  p.pct_regras                         as pct_regras_semana_anterior,
  round(b.pct_regras - p.pct_regras, 1) as variacao_regras_pp,
  -- Conversas novas que receberam ao menos uma resposta humana.
  b.pct_conversas_com_humano           as pct_conversas_com_humano_atual,
  p.pct_conversas_com_humano           as pct_conversas_com_humano_semana_anterior,
  round(b.pct_conversas_com_humano - p.pct_conversas_com_humano, 1) as variacao_humano_pp,
  b.ia_indisponivel                    as ia_indisponivel_atual,
  p.ia_indisponivel                    as ia_indisponivel_semana_anterior
from base b
left join base p on p.clinic_id = b.clinic_id and p.semana = b.semana - 7;

comment on view metabase_chatbot_kpis_semanais is
  'KPIs semanais do chatbot de WhatsApp com comparativo vs. semana anterior. meta_max_pct_fallback (3%) é proposta de partida, ajustável pela gestão.';

-- Perguntas que o bot não soube responder nos últimos 30 dias: fallback genérico,
-- IA indisponível ou escalonamento "fora da base". É a fila de onde nasce cada
-- nova entrada do clinic_faq.
create or replace view metabase_chatbot_perguntas_sem_resposta with (security_invoker = true) as
select *
from (
  select
    c.clinic_id,
    b.id as message_id,
    b.conversation_id,
    b.sent_at,
    b.intent,
    (
      select u.body
      from messages u
      where u.conversation_id = b.conversation_id
        and u.channel = 'whatsapp'
        and u.sender_type = 'user'
        and u.body is not null
        and u.sent_at <= b.sent_at
      order by u.sent_at desc
      limit 1
    ) as pergunta
  from messages b
  join twilio_conversations c on c.id = b.conversation_id
  where b.channel = 'whatsapp'
    and b.sender_type = 'bot'
    and b.sent_at > now() - interval '30 days'
    and b.intent in ('atendimento_geral', 'ia_indisponivel', 'escalado_fora_da_base')
) q
-- Só texto de pergunta: descarta CPF/telefone/data soltos do fluxo AGENDAR.
where q.pergunta ~ '[[:alpha:]]{3}' and length(q.pergunta) between 8 and 400;

comment on view metabase_chatbot_perguntas_sem_resposta is
  'Última mensagem da família antes de um fallback, IA indisponível ou escalonamento fora_da_base (30 dias). Fonte da aba "Perguntas sem resposta".';

do $$
declare v text;
begin
  foreach v in array array['metabase_chatbot_kpis_semanais', 'metabase_chatbot_perguntas_sem_resposta'] loop
    execute format('revoke all on public.%I from anon', v);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', v);
  end loop;
end $$;
