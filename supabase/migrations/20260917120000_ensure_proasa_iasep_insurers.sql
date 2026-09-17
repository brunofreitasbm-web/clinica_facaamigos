-- supabase/migrations/20260917120000_ensure_proasa_iasep_insurers.sql
-- Garante que PROASA e IASEP estejam cadastrados na tabela `insurers` como convênios ativos
-- para todas as clínicas cadastradas no sistema.

-- 1. Inserir PROASA se não existir
insert into insurers (clinic_id, name, active)
select c.id, 'PROASA', true
from clinics c
where not exists (
  select 1 from insurers i where i.clinic_id = c.id and upper(trim(i.name)) = 'PROASA'
);

-- 2. Inserir IASEP se não existir
insert into insurers (clinic_id, name, active)
select c.id, 'IASEP', true
from clinics c
where not exists (
  select 1 from insurers i where i.clinic_id = c.id and upper(trim(i.name)) = 'IASEP'
);

-- 3. Garantir que registros com nome PROASA ou IASEP estejam ativos
update insurers
set active = true
where upper(trim(name)) in ('PROASA', 'IASEP') and active = false;

-- 4. Atualizar a base de conhecimento do Chatbot (clinic_faq) para explicitar convênios atendidos
update clinic_faq
set
  answer = 'Atendemos por convênio (como PROASA, IASEP, Unimed, entre outros) e também na modalidade particular com reembolso 💙 Se o seu plano for PROASA ou IASEP, você pode realizar o atendimento conosco! Qual é o plano da criança?',
  updated_at = now()
where question = 'Vocês atendem plano de saúde?';

-- 5. Inserir ou atualizar pergunta frequente específica para a mensagem inicial vinda do site sobre IASEP & PROASA
insert into clinic_faq (clinic_id, question, answer, keywords, category, sort_order)
select
  c.id,
  'Gostaria de informações sobre atendimento IASEP e PROASA no FaçaAmigos - Centro de Terapia Comportamental',
  E'Sim! 💙 Atendemos pelos convênios *IASEP* e *PROASA* com muito carinho!\n\nComo prefere prosseguir?\n1️⃣ *Agendar 1ª Avaliação*: Responda *AGENDAR* para escolher um horário.\n2️⃣ *Enviar Guia ou Laudo*: Envie a foto ou PDF do seu pedido médico por aqui.\n3️⃣ *Dúvidas/Atendimento Humano*: Escreva sua dúvida que nossa equipe te responde já!',
  array['iasep','proasa','informacoes','informações','atendimento iasep','atendimento proasa','site','façaamigos','facaamigos'],
  'convenios',
  5
from clinics c
where not exists (
  select 1 from clinic_faq f where f.clinic_id = c.id and f.question ilike '%atendimento IASEP e PROASA%'
);
