-- supabase/migrations/20260906000013_seed_quick_responses.sql
-- Respostas rápidas padrão da Central de Atendimento (PRD), editáveis depois
-- pelo gestor/supervisor pela própria UI. Só existe uma clínica cadastrada
-- neste ambiente, então o select em `clinics` sempre resolve para ela.

insert into quick_responses (clinic_id, shortcut, title, content_text)
select id, '/endereco', 'Endereço', 'Estamos localizados na Rua Exemplo, 123 - Bairro, Cidade/UF. Em frente ao portão principal há vagas de estacionamento para pacientes.'
from clinics
on conflict (clinic_id, shortcut) do nothing;

insert into quick_responses (clinic_id, shortcut, title, content_text)
select id, '/valores', 'Tabela de Valores', 'Nossos valores para atendimento particular e reembolso variam conforme a especialidade. Consulte nossa tabela atualizada ou fale com a recepção para um orçamento detalhado.'
from clinics
on conflict (clinic_id, shortcut) do nothing;

insert into quick_responses (clinic_id, shortcut, title, content_text)
select id, '/regras-falta', 'Regras de Falta', 'Pedimos que faltas ou reagendamentos sejam avisados com pelo menos 24h de antecedência. Faltas sem aviso prévio podem ser cobradas conforme contrato de prestação de serviços.'
from clinics
on conflict (clinic_id, shortcut) do nothing;

insert into quick_responses (clinic_id, shortcut, title, content_text)
select id, '/convenios', 'Convênios Aceitos', 'Trabalhamos com diversos convênios e também na modalidade particular com emissão de nota fiscal para reembolso. Me diga qual o seu plano que eu confirmo a cobertura.'
from clinics
on conflict (clinic_id, shortcut) do nothing;
