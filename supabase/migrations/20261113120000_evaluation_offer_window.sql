-- Janela das re-sugestões da 1ª avaliação: data do 1º horário da 1ª lista enviada.
-- Nenhum horário oferecido depois pode passar de âncora + 7 dias.
alter table evaluation_offers add column if not exists offer_anchor_date date;
