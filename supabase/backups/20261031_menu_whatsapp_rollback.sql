-- Rollback da Fase 0 do menu do WhatsApp (gravada em 2026-10-31).
-- Desfaz: preços particulares (insurer_price_tables) e 3 respostas de clinic_faq.
begin;

-- 1. Preços: remove as linhas criadas hoje e reabre as antigas.
delete from insurer_price_tables
 where insurer_id = 'daab822c-612e-41ab-b2e2-1ede652e9bcf' and valid_from = '2026-10-31';
update insurer_price_tables set valid_to = null
 where insurer_id = 'daab822c-612e-41ab-b2e2-1ede652e9bcf' and valid_to = '2026-10-30';

-- 2. FAQs: textos anteriores.
update clinic_faq set answer = 'Trabalhamos com pacote mensal adiantado: 10 sessões por mês, pagas no início do mês. Essa forma fideliza o atendimento e reduz bastante as faltas em comparação com sessão avulsa. 💙',
  keywords = '{pacote,mensalidade,"plano de pagamento","10 sessoes"}' where id = '9efc1399-bdfb-4908-81aa-6e6df2cafdda';
update clinic_faq set answer = 'Sim, cobrança avulsa por sessão também é possível, mas o pacote mensal adiantado costuma sair mais em conta e evita faltas. 💛'
 where id = 'b9361c7e-a655-493c-8e98-35c465d0fa26';
update clinic_faq set answer = 'Estamos em busca de novos talentos! Para cadastrar seu currículo no nosso banco de dados, acesse: https://institutofacaamigos.com.br/ e acesse o link "Venha fazer parte do nosso time". Boa sorte!'
 where id = 'dc3d0cd0-1e83-4176-a81a-1ba205c9e039';
update clinic_faq set answer = E'Somos uma equipe multidisciplinar de desenvolvimento infantil. Atendemos:\n\n🔹 *Fonoaudiologia*\n🔹 *Terapia Ocupacional* (inclusive Integração Sensorial e AVD)\n🔹 *Psicologia ABA*\n🔹 *Psicoterapia*\n🔹 *Neuropsicologia* e Avaliação Neuropsicológica\n🔹 *Psicopedagogia*\n🔹 *Musicoterapia*\n🔹 *Psicomotricidade*\n\nMe conta qual terapia você procura e o plano de saúde da criança (ou se é particular) que eu te oriento. 💛',
  keywords = '{terapia,terapias,fono,fonoaudiologia,to,"terapia ocupacional",aba,psicologia,psicoterapia,neuropsicologia,"integracao sensorial","integração sensorial",avd,especialidade}'
 where id = '319f7590-856d-4b36-87e6-03b81ec504f8';

commit;
-- Preços antigos (todas valid_from 2026-09-17): FONO-ABA 200, FONO-CONV 150, IS 200, MUSICO 200,
-- PSI-ABA 200, PSICOMOT 200, PSICOTER 150 (30 min), TO-ABA 200, TO-CONV 150.

-- Faturamento pelo valor do pacote (migration 20261031234723_particular_package_billing):
-- para desfazer, restaure generate_package_invoices ao cálculo antigo (unit_price * sessions_per_month,
-- só contratos com unit_price e sessions_per_month) e os preços de specialty_prices:
--   psicologia_aba/fonoaudiologia/terapia_ocupacional/integracao_sensorial/musicoterapia/psicomotricidade = 200
--   fono_convencional/to_convencional/psicoterapia = 150
