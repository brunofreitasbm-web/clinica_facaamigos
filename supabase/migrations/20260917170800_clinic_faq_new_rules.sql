-- supabase/migrations/20260917170800_clinic_faq_new_rules.sql
-- Atualiza/insere conhecimento do Chatbot (clinic_faq) com as novas
-- diretrizes: atendimento particular (pacote mensal, valores por
-- especialidade, duracao), regras de plano de saude (guia previa, pedido
-- medico, psicoterapia infantil em grupo) e a nova politica de faltas
-- (2 faltas consecutivas sem justificativa = desligamento automatico da
-- agenda). Segue o mesmo padrao de 20260913210000 (update por texto exato
-- da pergunta + insert idempotente por not exists).

update clinic_faq
set
  answer = case question
    when 'Quanto tempo dura cada sessao?' then
      'A duracao varia por especialidade: Psicologia ABA, Fonoaudiologia e Terapia Ocupacional (incluindo Integracao Sensorial e Psicomotricidade) e Musicoterapia duram 40 minutos. Psicoterapia dura 30 minutos. 🕐'
    when 'Quanto tempo dura cada sessão?' then
      'A duração varia por especialidade: Psicologia ABA, Fonoaudiologia e Terapia Ocupacional (incluindo Integração Sensorial e Psicomotricidade) e Musicoterapia duram 40 minutos. Psicoterapia dura 30 minutos. 🕐'
    when 'Quais sao os valores das sessoes?' then
      'Os valores variam por especialidade e a modalidade preferencial e o pacote mensal adiantado (10 sessoes por mes), que reduz bastante as faltas. Sessao avulsa tambem e possivel. Consulte os valores atualizados com a nossa equipe. 💛'
    when 'Quais são os valores das sessões?' then
      'Os valores variam por especialidade e a modalidade preferencial é o pacote mensal adiantado (10 sessões por mês), que reduz bastante as faltas. Sessão avulsa também é possível. Consulte os valores atualizados com a nossa equipe. 💛'
    else answer
  end,
  updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001'
  and question in (
    'Quanto tempo dura cada sessao?', 'Quanto tempo dura cada sessão?',
    'Quais sao os valores das sessoes?', 'Quais são os valores das sessões?'
  );

insert into clinic_faq (clinic_id, question, answer, keywords, category, sort_order)
select c.id, v.question, v.answer, v.keywords, v.category, v.sort_order
from clinics c
cross join (values
  (
    'Como funciona o pacote mensal?',
    'Trabalhamos com pacote mensal adiantado: 10 sessoes por mes, pagas no inicio do mes. Essa forma fideliza o atendimento e reduz bastante as faltas em comparacao com sessao avulsa. 💙',
    array['pacote','mensalidade','plano de pagamento','10 sessoes'],
    'valores', 20
  ),
  (
    'Posso pagar por sessao avulsa?',
    'Sim, cobranca avulsa por sessao tambem e possivel, mas o pacote mensal adiantado costuma sair mais em conta e evita faltas. 💛',
    array['avulsa','pagar por sessao','sessao unica'],
    'valores', 21
  ),
  (
    'Emitem recibo do pagamento?',
    'Sim! Emitimos recibo automaticamente a cada pagamento, tanto para reembolso junto ao seu plano de saude quanto para o seu controle financeiro. Ele e enviado por aqui mesmo, pelo WhatsApp. 🧾',
    array['recibo','comprovante','nota','reembolso'],
    'valores', 22
  ),
  (
    'Qual a politica de faltas?',
    'Pedimos que avisos de remarcacao sejam feitos com pelo menos 24h de antecedencia. Ja em caso de falta sem justificativa: 2 faltas consecutivas sem justificativa liberam o horario fixo automaticamente. Se precisar faltar, avise a recepcao ou justifique pelo portal da familia. 💙',
    array['falta','faltar','desligamento','cancelamento','ausencia'],
    'regras', 23
  ),
  (
    'Preciso de guia autorizada para psicoterapia pelo convenio?',
    'Sim. Para psicoterapia pelo convenio, a guia de autorizacao precisa estar validada ANTES do primeiro atendimento — sem isso nao conseguimos liberar o horario. Para atendimento particular nao e necessario. 📋',
    array['guia','autorizacao','psicoterapia convenio','plano de saude'],
    'convenios', 24
  ),
  (
    'Psicoterapia infantil pelo convenio e individual ou em grupo?',
    'Para criancas ate 9 anos, a psicoterapia pelo convenio pode ser feita em grupo de ate 3 criancas da mesma faixa etaria, sessoes de 30 minutos. Para adultos, e sempre individual. Cada crianca tem prontuario e guia consumida individualmente, mesmo no grupo. 👥',
    array['grupo infantil','psicoterapia crianca','grupo psicoterapia'],
    'terapias', 25
  )
) as v(question, answer, keywords, category, sort_order)
where not exists (
  select 1 from clinic_faq cf where cf.clinic_id = c.id and cf.question = v.question
);
