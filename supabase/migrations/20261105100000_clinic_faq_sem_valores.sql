-- supabase/migrations/20261105100000_clinic_faq_sem_valores.sql
-- NÃO APLICADA. Escrita junto com a regra "o bot nunca escreve valor em texto"
-- (lib/price-policy-pure.ts). Remove os preços em reais de duas respostas do
-- `clinic_faq`; o preço particular passa a sair só pela arte de pacotes
-- (planos-particular.png), enviada pelo bot antes de transbordar para a equipe.
-- Sem esta migration o bot já não envia esses textos com valor (trava de saída
-- em lib/price-policy.ts), mas a aba Chatbot continua mostrando-os à recepção.
-- Só toca as linhas pelo texto exato da pergunta; sem casar, não altera nada.

update clinic_faq
set answer = case question
  when 'Como funcionam os planos mensais?' then
    'Os pacotes são mensais, pagos no início do mês, com sessões de qualquer especialidade, combináveis (ex.: 4 de Fono + 4 de TO). A quantidade e a distribuição das terapias dependem de cada criança. A avaliação inicial conta como 1 sessão do pacote; cada bloco de Treino ABA (3 sessões seguidas) conta como 3. Parcelamos em até 3x no cartão.'
  when 'Posso pagar por sessão avulsa?' then
    'Sim! Existe a sessão avulsa (plano *Encontro*, 40 minutos). Para ver as opções, a nossa equipe te atende por aqui.'
end
where question in ('Como funcionam os planos mensais?', 'Posso pagar por sessão avulsa?');
