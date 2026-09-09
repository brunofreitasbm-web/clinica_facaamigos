-- supabase/migrations/20260909110000_clinic_faq.sql
-- Base de conhecimento do agente de WhatsApp (lib/twilio-faq-bot.ts).
--
-- Fonte ÚNICA: alimenta tanto o grounding do Gemini quanto os botões de
-- resposta sugerida da Central de Atendimento. Antes disso o conhecimento do
-- bot estava fixo no código (lib/twilio.ts) e só conhecia convênios — endereço,
-- horário e valores não existiam em lugar nenhum do banco (a tabela `clinics`
-- só tem nome/CNPJ, e as 4 linhas de `quick_responses` eram placeholder).

create table clinic_faq (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id),
  question text not null,
  answer text not null,
  -- Sinônimos que a família costuma usar e que não aparecem na pergunta.
  -- Entram no prompt para ajudar o modelo a casar a dúvida com a resposta.
  keywords text[] not null default '{}',
  category text check (category in ('convenios','valores','local','terapias','horarios','regras','outro')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinic_faq_clinic_active_idx on clinic_faq (clinic_id, active, sort_order);

alter table clinic_faq enable row level security;

-- Recepção lê (usa como resposta rápida na Central); gestor e supervisão
-- editam — mesmo par de papéis de quick_responses.
create policy clinic_faq_read on clinic_faq for select
  using (
    clinic_id = current_clinic_id()
    and app_current_role() in ('gestor','supervisor','recepcao')
  );

create policy clinic_faq_manage on clinic_faq for all
  using (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'))
  with check (clinic_id = current_clinic_id() and app_current_role() in ('gestor','supervisor'));

-- =====================================================================
-- Seed. As respostas de terapias/rotina são reais (derivadas de
-- appointment_types). Endereço, telefone, horário e valores ficam marcados
-- com ⚠️ TODO de propósito: o bot é instruído a ESCALAR em vez de inventar,
-- então uma resposta não preenchida vira atendimento humano, nunca invenção.
-- Preencher em /gestor/cadastros/faq antes de ligar o bot.
-- =====================================================================
insert into clinic_faq (clinic_id, question, answer, keywords, category, sort_order)
select
  c.id,
  v.question,
  v.answer,
  v.keywords,
  v.category,
  v.sort_order
from clinics c
cross join (values
  (
    'Vocês atendem plano de saúde?',
    'Sim! Trabalhamos com convênios parceiros e também no particular. Para os planos que não atendemos diretamente, emitimos nota fiscal e relatórios para você solicitar o *reembolso*. Me diga qual é o seu plano que eu confirmo pra você. 💛',
    array['convenio','convênio','plano','planos','carteirinha','reembolso','cobertura','particular'],
    'convenios',
    10
  ),
  (
    'Que terapias vocês oferecem?',
    E'Somos uma equipe multidisciplinar de desenvolvimento infantil. Atendemos:\n\n🔹 *Fonoaudiologia*\n🔹 *Terapia Ocupacional* (inclusive Integração Sensorial e AVD)\n🔹 *Psicologia ABA*\n🔹 *Psicoterapia*\n🔹 *Neuropsicologia*\n\nQuer que eu te explique alguma delas?',
    array['terapia','terapias','fono','fonoaudiologia','to','terapia ocupacional','aba','psicologia','psicoterapia','neuropsicologia','integracao sensorial','integração sensorial','avd','especialidade'],
    'terapias',
    20
  ),
  (
    'Meu filho tem laudo de TEA (autismo). Vocês atendem?',
    'Atendemos sim, com muito carinho. Nossa equipe é especializada em desenvolvimento infantil e atende crianças com TEA, atraso de fala, dificuldades de aprendizagem e questões sensoriais. O laudo ajuda, mas *não é obrigatório* para começar: a avaliação inicial nos mostra o caminho. 💛',
    array['tea','autismo','autista','laudo','diagnostico','diagnóstico','neurodivergente','atraso','fala','sensorial'],
    'terapias',
    30
  ),
  (
    'Como começa o atendimento?',
    E'O primeiro passo é a *avaliação inicial (anamnese)*, uma conversa com a família para entender a história e as necessidades da criança.\n\nDepois disso a equipe monta o *PTS* (Plano Terapêutico Singular), com os objetivos e a frequência das sessões.\n\nQuer agendar a avaliação? É só me responder *AGENDAR*.',
    array['começar','comecar','inicio','início','primeira vez','avaliacao','avaliação','anamnese','triagem','como funciona','pts'],
    'regras',
    40
  ),
  (
    'Preciso de encaminhamento médico?',
    'Para o atendimento *particular* não é necessário encaminhamento. Já pelo *convênio*, na maioria dos planos é preciso um pedido médico e a guia autorizada. Se quiser, me envia uma foto do pedido aqui mesmo que a gente confere pra você.',
    array['encaminhamento','pedido medico','pedido médico','guia','autorizacao','autorização','receita'],
    'regras',
    50
  ),
  (
    'Quanto tempo dura cada sessão?',
    'Depende da especialidade: as sessões duram entre *30 e 40 minutos*. Fonoaudiologia e Psicoterapia costumam ser de 30 minutos; Terapia Ocupacional, Integração Sensorial, Psicologia ABA e Neuropsicologia, de 40 minutos.',
    array['duracao','duração','tempo','quanto tempo','minutos','sessao','sessão'],
    'regras',
    60
  ),
  (
    'Os pais podem acompanhar a sessão?',
    'A participação da família é parte do tratamento! O formato varia conforme a terapia e o momento da criança — em alguns casos os pais entram na sessão, em outros a conversa acontece na devolutiva com a terapeuta. A equipe combina isso com você logo na avaliação. 💛',
    array['pais','mae','mãe','pai','acompanhar','assistir','entrar na sala','responsavel','responsável'],
    'regras',
    70
  ),
  (
    'Como faço para desmarcar ou remarcar?',
    'Sem problema! Só pedimos que o aviso seja feito com *no mínimo 24 horas de antecedência*, para conseguirmos oferecer o horário a outra família. Pode avisar por aqui mesmo que a recepção remarca pra você.',
    array['desmarcar','remarcar','cancelar','faltar','falta','adiar','mudar horario','mudar horário'],
    'regras',
    80
  ),
  (
    'Onde fica a clínica?',
    '⚠️ TODO: preencher o endereço completo, ponto de referência e link do Google Maps em /gestor/cadastros/faq.',
    array['endereco','endereço','onde fica','localizacao','localização','como chegar','mapa','bairro','rua'],
    'local',
    90
  ),
  (
    'Qual o horário de funcionamento?',
    '⚠️ TODO: preencher os dias e horários de atendimento em /gestor/cadastros/faq.',
    array['horario','horário','funcionamento','abre','fecha','sabado','sábado','domingo','feriado','atendimento'],
    'horarios',
    100
  ),
  (
    'Quais são os valores das sessões?',
    '⚠️ TODO: preencher a política de valores (particular, pacote, avaliação) em /gestor/cadastros/faq.',
    array['valor','valores','preco','preço','quanto custa','mensalidade','pacote','particular'],
    'valores',
    110
  ),
  (
    'Qual o telefone para contato?',
    '⚠️ TODO: preencher telefone e e-mail de contato em /gestor/cadastros/faq.',
    array['telefone','contato','ligar','email','e-mail','falar','numero','número'],
    'local',
    120
  )
) as v(question, answer, keywords, category, sort_order);
