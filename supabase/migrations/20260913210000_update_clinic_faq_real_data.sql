-- supabase/migrations/20260913210000_update_clinic_faq_real_data.sql
-- Atualiza as respostas da base de conhecimento do Chatbot (clinic_faq)
-- com os textos revisados da marca FaçaAmigos, dados de localização reais,
-- horários confirmados e diretrizes da clínica.

update clinic_faq
set
  answer = case question
    when 'Vocês atendem plano de saúde?' then
      'Atendemos por convênio e também particular 💙 Hoje trabalhamos com convênios parceiros. Não achou o seu na lista? Sem problema — emitimos nota fiscal e relatório para você solicitar o reembolso ao seu plano. Qual é o plano da criança?'
    when 'Que terapias vocês oferecem?' then
      E'Somos uma equipe multi que cuida do desenvolvimento infantil como um todo 🧩 Oferecemos:\n\n🔹 *Fonoaudiologia*\n🔹 *Terapia Ocupacional* (inclusive Integração Sensorial e AVD)\n🔹 *Psicologia ABA*\n🔹 *Psicoterapia*\n🔹 *Neuropsicologia*\n\nQuer que eu te explique alguma dessas ou já sabe qual sua criança precisa?'
    when 'Meu filho tem laudo de TEA (autismo). Vocês atendem?' then
      'Atendemos, sim! 🌱 O laudo ajuda a equipe a entender o histórico, mas não é obrigatório para começar — muitas famílias vêm pra gente ainda em investigação. O primeiro passo é sempre a avaliação inicial. Posso te ajudar a agendar?'
    when 'Como começa o atendimento?' then
      E'O primeiro passo é a *1ª avaliação (anamnese)* 📋 — uma conversa com a nossa equipe pra entender a criança e a família.\n\nA partir daí, montamos o *PTS* (Plano Terapêutico Singular), o plano sob medida. Se tiver laudo, pedido médico ou guia de convênio em mãos, já pode me mandar por aqui! Bora marcar? Responda *AGENDAR*.'
    when 'Preciso de encaminhamento médico?' then
      'Pelo particular, não precisa de nada disso pra começar 😊 Pelo convênio, o seu plano costuma pedir: pedido médico (com CID) + guia autorizada. Já tem esses documentos? Pode me mandar por aqui, foto ou PDF — nossa equipe confere tudo antes da sua avaliação.'
    when 'Quanto tempo dura cada sessão?' then
      'Todas as nossas sessões duram 40 minutos, seja qual for a terapia 🕐'
    when 'Os pais podem acompanhar a sessão?' then
      'A participação da família é parte do tratamento! O formato varia conforme a terapia e o momento da criança — em alguns casos os pais entram na sessão, em outros a conversa acontece na devolutiva com a terapeuta. A equipe combina isso com você logo na avaliação. 💛'
    when 'Como faço para desmarcar ou remarcar?' then
      'Sem problema! Só pedimos que o aviso seja feito com no mínimo 24 horas de antecedência, para conseguirmos oferecer o horário a outra família. Pode avisar por aqui mesmo que a recepção remarca pra você.'
    when 'Onde fica a clínica?' then
      'Ficamos na Rua Boaventura da Silva, 1573, Umarizal, Belém/PA — CEP 66060-147 📍 Quer que eu te mande a localização?'
    when 'Qual o horário de funcionamento?' then
      'Funcionamos de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h. ⏰'
    when 'Quais são os valores das sessões?' then
      'Por política da clínica, os valores das consultas e terapias particulares são informados diretamente por nossa equipe de atendimento. Vou chamar um atendente pra te passar todas as opções com carinho! 💛'
    when 'Qual o telefone para contato?' then
      'Você pode falar com a gente pelo telefone ou WhatsApp no número (91) 99178-2027 📞'
    else answer
  end,
  updated_at = now()
where clinic_id = 'c0000000-0000-0000-0000-000000000001';
