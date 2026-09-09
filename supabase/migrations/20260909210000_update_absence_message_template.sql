-- Migration: Atualiza o template de notificação de falta para não oferecer reagendamento.

update message_templates
set body = 'Infelizmente a clínica sente a ausência de {{1}}. Aguardamos vocês na próxima sessão agendada!'
where category = 'falta';

-- Atualiza resposta de FAQ para esclarecer política de não-reagendamento de faltas
update clinic_faq
set answer = 'Infelizmente a clínica sente a ausência dos nossos alunos/pacientes, porém a política da nossa clínica não realiza reagendamento de faltas. Aguardamos vocês na próxima sessão agendada! 💛'
where question ilike '%desmarcar%' or question ilike '%remarcar%' or question ilike '%falta%';
